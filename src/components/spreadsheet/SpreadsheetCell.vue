<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useColumnsStore } from "@/stores/columns";
import { usePendingsStore } from "@/stores/pendings";

const props = defineProps({
  value: {
    type: [String, Number, Date, Object, null],
    default: null,
  },
  columnKey: {
    type: String,
    required: true,
  },
  columnType: {
    type: String,
    default: "text", // text, number, date, select
  },
  columnOptions: {
    type: Array,
    default: () => [],
  },
  orderId: {
    type: String,
    required: true,
  },
  orderVersion: {
    type: Number,
    default: 1,
  },
  orderMonth: {
    type: String,
    required: true,
  },
  isEditable: {
    type: Boolean,
    default: false,
  },
  requiresApproval: {
    type: Boolean,
    default: false,
  },
  pendingChange: {
    type: Object,
    default: null,
  },
  isLocked: {
    type: Boolean,
    default: false,
  },
  lockedBy: {
    type: String,
    default: null,
  },
  isCostRow: {
    type: Boolean,
    default: false,
  },
  highlightChange: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["save", "cancel", "pending-created"]);

const authStore = useAuthStore();
const columnsStore = useColumnsStore();
const pendingsStore = usePendingsStore();

// Local state
const isEditing = ref(false);
const editValue = ref("");
const inputRef = ref(null);
const validationError = ref(null);
const isSaving = ref(false);
const showPendingTooltip = ref(false);

// Check if current user owns the pending change
const isOwnPending = computed(() => {
  if (!props.pendingChange) return false;
  return props.pendingChange.requestedBy === authStore.user?.uid;
});

// Can edit this cell?
const canEdit = computed(() => {
  // Cannot edit if locked by another user's pending
  if (props.isLocked && !isOwnPending.value) return false;
  // Cannot edit if not editable
  if (!props.isEditable) return false;
  // Cost rows require Manager+
  if (
    props.isCostRow &&
    !["manager", "super_admin"].includes(authStore.userRole)
  ) {
    return false;
  }
  return true;
});

// Format display value based on column type
const displayValue = computed(() => {
  if (props.value === null || props.value === undefined || props.value === "") {
    return "—";
  }

  // Handle Date objects
  if (props.value instanceof Date) {
    return formatDate(props.value);
  }

  // Handle Firestore Timestamp
  if (props.value?.toDate && typeof props.value.toDate === "function") {
    return formatDate(props.value.toDate());
  }

  // Handle timestamp as plain object
  if (
    typeof props.value === "object" &&
    typeof props.value.seconds === "number"
  ) {
    return formatDate(new Date(props.value.seconds * 1000));
  }

  // Format based on column type
  if (props.columnType === "number" && typeof props.value === "number") {
    return props.value.toLocaleString();
  }

  if (props.columnType === "date" || props.columnType === "timestamp") {
    try {
      return formatDate(new Date(props.value));
    } catch {
      return String(props.value);
    }
  }

  return String(props.value);
});

// Format date helper
function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return "—";
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${dateStr} ${timeStr}`;
}

// Format date/time for tooltip
function formatDateTime(date) {
  if (!date) return "—";
  try {
    if (date?.toDate && typeof date.toDate === "function") {
      date = date.toDate();
    } else if (typeof date === "object" && typeof date.seconds === "number") {
      date = new Date(date.seconds * 1000);
    }
    return new Date(date).toLocaleString();
  } catch {
    return "—";
  }
}

// Start editing
function startEdit() {
  if (!canEdit.value) return;

  isEditing.value = true;
  editValue.value = props.value ?? "";
  validationError.value = null;

  nextTick(() => {
    inputRef.value?.focus();
    inputRef.value?.select();
  });
}

// Cancel editing
function cancelEdit() {
  isEditing.value = false;
  editValue.value = "";
  validationError.value = null;
  emit("cancel");
}

// Validate input based on column type (T-DATA-006)
function validate(value) {
  if (props.columnType === "number") {
    if (value !== "" && isNaN(Number(value))) {
      return "Please enter a valid number";
    }
  }

  if (props.columnType === "date") {
    if (value !== "" && isNaN(Date.parse(value))) {
      return "Please enter a valid date";
    }
  }

  if (props.columnType === "select" && props.columnOptions.length > 0) {
    if (value !== "" && !props.columnOptions.includes(value)) {
      return `Please select one of: ${props.columnOptions.join(", ")}`;
    }
  }

  return null;
}

// Save changes
async function saveEdit() {
  // Validate
  const error = validate(editValue.value);
  if (error) {
    validationError.value = error;
    return;
  }

  // No change
  if (editValue.value === props.value) {
    cancelEdit();
    return;
  }

  isSaving.value = true;
  validationError.value = null;

  try {
    // Convert value based on type
    let finalValue = editValue.value;
    if (props.columnType === "number" && editValue.value !== "") {
      finalValue = Number(editValue.value);
    }

    if (props.requiresApproval) {
      // Create pending change request
      await pendingsStore.createPending({
        targetCollection: props.isCostRow ? "costs" : "orders",
        targetId: props.orderId,
        orderMonth: props.orderMonth,
        field: props.columnKey,
        baseValue: props.value,
        baseVersion: props.orderVersion,
        newValue: finalValue,
      });
      emit("pending-created", {
        field: props.columnKey,
        newValue: finalValue,
      });
    } else {
      // Direct save (T-UX-001: optimistic update handled by parent)
      emit("save", {
        field: props.columnKey,
        value: finalValue,
        previousValue: props.value,
      });
    }

    isEditing.value = false;
    editValue.value = "";
  } catch (err) {
    validationError.value = err.message || "Failed to save";
  } finally {
    isSaving.value = false;
  }
}

// Handle keyboard shortcuts
function handleKeydown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    saveEdit();
  } else if (event.key === "Escape") {
    cancelEdit();
  }
}

// Handle click outside to save
function handleBlur() {
  if (isEditing.value && !isSaving.value) {
    saveEdit();
  }
}
</script>

<template>
  <div
    class="spreadsheet-cell relative group"
    :class="{
      'bg-amber-50': pendingChange && !isEditing,
      'bg-blue-50': isEditing,
      'bg-green-100 animate-pulse': highlightChange,
      'cursor-pointer hover:bg-gray-50': canEdit && !isEditing,
      'cursor-not-allowed opacity-60': !canEdit && !isEditing,
      'bg-purple-50': isCostRow,
    }"
    @dblclick="startEdit"
  >
    <!-- Display mode -->
    <div
      v-if="!isEditing"
      class="flex items-center gap-1 px-2 py-1.5 min-h-[36px]"
    >
      <!-- Lock icon when cell has pending change -->
      <svg
        v-if="pendingChange"
        class="w-3.5 h-3.5 flex-shrink-0"
        :class="isOwnPending ? 'text-blue-400' : 'text-gray-400'"
        fill="currentColor"
        viewBox="0 0 20 20"
        :title="
          isOwnPending
            ? 'Locked by your pending change'
            : `Locked by ${lockedBy || pendingChange.requestedByName}`
        "
      >
        <path
          fill-rule="evenodd"
          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
          clip-rule="evenodd"
        />
      </svg>

      <!-- Value -->
      <span class="truncate flex-1" :title="String(value)">
        {{ displayValue }}
      </span>

      <!-- Pending indicator with tooltip -->
      <div
        v-if="pendingChange"
        class="flex-shrink-0 relative"
        @mouseenter="showPendingTooltip = true"
        @mouseleave="showPendingTooltip = false"
      >
        <svg
          class="w-4 h-4 cursor-help"
          :class="isOwnPending ? 'text-blue-500' : 'text-amber-500'"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fill-rule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd"
          />
        </svg>

        <!-- Tooltip -->
        <Teleport to="body">
          <div
            v-if="showPendingTooltip"
            class="fixed z-[9999] w-72 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-4"
            :style="{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }"
          >
            <div class="font-semibold text-amber-400 mb-3 text-sm">
              ⏳ Pending Change Request
            </div>
            <div class="space-y-2">
              <div class="flex justify-between">
                <span class="text-gray-400">Requested by:</span>
                <span class="text-white font-medium">{{
                  pendingChange.requestedByName || "—"
                }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Requested at:</span>
                <span class="text-white">{{
                  formatDateTime(pendingChange.requestedAt)
                }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">New value:</span>
                <span class="text-green-400 font-bold">{{
                  pendingChange.newValue ?? "—"
                }}</span>
              </div>
              <div
                v-if="isOwnPending"
                class="mt-2 pt-2 border-t border-gray-700"
              >
                <span class="text-blue-400 text-xs"
                  >This is your pending request</span
                >
              </div>
            </div>
          </div>
        </Teleport>
      </div>

      <!-- Edit hint on hover -->
      <svg
        v-if="canEdit && !pendingChange"
        class="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
        />
      </svg>
    </div>

    <!-- Edit mode -->
    <div v-else class="px-1 py-0.5">
      <!-- Text input -->
      <input
        v-if="columnType === 'text' || columnType === 'number'"
        ref="inputRef"
        v-model="editValue"
        :type="columnType === 'number' ? 'number' : 'text'"
        class="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        :class="{ 'border-red-400': validationError }"
        @keydown="handleKeydown"
        @blur="handleBlur"
        :disabled="isSaving"
      />

      <!-- Date input -->
      <input
        v-else-if="columnType === 'date'"
        ref="inputRef"
        v-model="editValue"
        type="date"
        class="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        :class="{ 'border-red-400': validationError }"
        @keydown="handleKeydown"
        @blur="handleBlur"
        :disabled="isSaving"
      />

      <!-- Select input -->
      <select
        v-else-if="columnType === 'select'"
        ref="inputRef"
        v-model="editValue"
        class="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        :class="{ 'border-red-400': validationError }"
        @keydown="handleKeydown"
        @blur="handleBlur"
        :disabled="isSaving"
      >
        <option value="">Select...</option>
        <option v-for="opt in columnOptions" :key="opt" :value="opt">
          {{ opt }}
        </option>
      </select>

      <!-- Validation error -->
      <div
        v-if="validationError"
        class="absolute left-0 top-full mt-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded shadow-lg z-10 whitespace-nowrap"
      >
        {{ validationError }}
      </div>

      <!-- Saving indicator -->
      <div
        v-if="isSaving"
        class="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center"
      >
        <svg
          class="w-4 h-4 animate-spin text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    </div>

    <!-- Requires approval badge -->
    <div
      v-if="requiresApproval && canEdit && !isEditing && !pendingChange"
      class="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full"
      title="Changes require approval"
    />
  </div>
</template>

<style scoped>
.spreadsheet-cell {
  min-width: 80px;
}
</style>
