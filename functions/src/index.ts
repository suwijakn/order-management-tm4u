import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

/**
 * Scheduled function: Run daily at midnight UTC
 * Auto-reject expired pending changes (expiresAt < now AND status='pending')
 * 
 * This function:
 * 1. Queries all pending_changes where status='pending' AND expiresAt < now
 * 2. Updates each to status='rejected' with system comment
 * 3. Creates audit log entries for tracking
 */
export const autoExpirePendings = functions.pubsub
  .schedule("every day 00:00")
  .timeZone("UTC")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    
    console.log("[autoExpirePendings] Running at", now.toDate().toISOString());

    try {
      // Query expired pendings
      const expiredSnapshot = await db
        .collection("pending_changes")
        .where("status", "==", "pending")
        .where("expiresAt", "<", now)
        .get();

      if (expiredSnapshot.empty) {
        console.log("[autoExpirePendings] No expired pendings found");
        return null;
      }

      console.log(`[autoExpirePendings] Found ${expiredSnapshot.size} expired pendings`);

      // Process in batches of 500 (Firestore batch limit)
      const BATCH_SIZE = 500;
      const docs = expiredSnapshot.docs;
      
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const batchDocs = docs.slice(i, i + BATCH_SIZE);

        for (const doc of batchDocs) {
          const data = doc.data();

          // Update pending to rejected
          batch.update(doc.ref, {
            status: "rejected",
            reviewedAt: now,
            reviewedBy: "system",
            reviewComment: "Auto-rejected: Request expired after 7 days",
          });

          // Create audit log entry
          const auditRef = db.collection("audit_logs").doc();
          batch.set(auditRef, {
            action: "pending_auto_expired",
            targetCollection: data.targetCollection || "orders",
            targetId: data.targetId,
            field: data.field,
            pendingId: doc.id,
            requestedBy: data.requestedBy,
            oldValue: data.oldValue,
            newValue: data.newValue,
            expiresAt: data.expiresAt,
            processedAt: now,
            processedBy: "system",
          });
        }

        await batch.commit();
        console.log(`[autoExpirePendings] Processed batch ${Math.floor(i / BATCH_SIZE) + 1}`);
      }

      console.log(
        `[autoExpirePendings] Successfully rejected ${expiredSnapshot.size} expired pendings`
      );

      return null;
    } catch (error) {
      console.error("[autoExpirePendings] Error:", error);
      throw error;
    }
  });
