<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useColumnsStore } from "@/stores/columns";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "vue-router";

const columnsStore = useColumnsStore();
const authStore = useAuthStore();
const router = useRouter();

// Processing states
const processingKey = ref(null);
const savingOrder = ref(false);

// Modals
const showAddModal = ref(false);
const showEditModal = ref(false);
const showDeleteModal = ref(false);

// Configurable roles (Jr/Sr Sales) - these can be edited
const configurableRoles = [
  { id: "jr_sales", label: "Jr. Sales" },
  { id: "sr_sales", label: "Sr. Sales" },
];

// Fixed roles (Manager/Super Admin) - always full access, no approval needed
const fixedRoles = [
  { id: "manager", label: "Manager" },
  { id: "super_admin", label: "Super Admin" },
];

// Default permission template
const defaultPermissions = () => ({
  jr_sales: { visible: false, editable: false, requiresApproval: false },
  sr_sales: { visible: false, editable: false, requiresApproval: false },
  manager: { visible: true, editable: true, requiresApproval: false },
  super_admin: { visible: true, editable: true, requiresApproval: false },
});

// Form data
const newColumn = ref({
  key: "",
  label: "",
  type: "text",
  isDataRelated: true,
  options: [],
});
const newColumnPermissions = ref(defaultPermissions());
const editingColumn = ref(null);
const editingColumnPermissions = ref(defaultPermissions());
const deletingColumn = ref(null);
const confirmDeleteKey = ref("");

// Data counts for impact display
const editingColumnDataCount = ref(0);
const deletingColumnDataCount = ref(0);

// Options editor for select type
const newOption = ref("");

// Drag and drop state
const draggedIndex = ref(null);
const dragOverIndex = ref(null);

// Only Super Admin can access
const isSuperAdmin = computed(() => {
  return authStore.userRole === "super_admin";
});

// Sorted columns for display
const sortedColumns = computed(() => {
  return [...columnsStore.definitions].sort((a, b) => a.order - b.order);
});

// Validation
const keyError = computed(() => {
  const key = newColumn.value.key;
  if (!key) return null;
  if (!/^[a-z]/.test(key)) return "Must start with a lowercase letter";
  if (!/^[a-z][a-z0-9_]*$/.test(key))
    return "Only lowercase letters, numbers, and underscores allowed";
  if (columnsStore.definitions.some((c) => c.key === key))
    return "Column key already exists";
  return null;
});

const canCreateColumn = computed(() => {
  return (
    newColumn.value.key &&
    newColumn.value.label &&
    newColumn.value.type &&
    !keyError.value &&
    (newColumn.value.type !== "select" || newColumn.value.options.length > 0)
  );
});

// Lifecycle
onMounted(() => {
  if (!isSuperAdmin.value) {
    router.push({ name: "Dashboard" });
    return;
  }
  columnsStore.fetchColumns();
});

// Auto-lowercase key
watch(
  () => newColumn.value.key,
  (val) => {
    newColumn.value.key = val.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  },
);

// Add Column Modal
function openAddModal() {
  newColumn.value = {
    key: "",
    label: "",
    type: "text",
    isDataRelated: true,
    options: [],
  };
  newColumnPermissions.value = defaultPermissions();
  newOption.value = "";
  showAddModal.value = true;
}

function closeAddModal() {
  showAddModal.value = false;
}

function addOption() {
  if (
    newOption.value.trim() &&
    !newColumn.value.options.includes(newOption.value.trim())
  ) {
    newColumn.value.options.push(newOption.value.trim());
    newOption.value = "";
  }
}

function removeOption(index) {
  newColumn.value.options.splice(index, 1);
}

async function createColumn() {
  if (!canCreateColumn.value) return;

  processingKey.value = "new";
  try {
    await columnsStore.createColumn({
      key: newColumn.value.key,
      label: newColumn.value.label,
      type: newColumn.value.type,
      isDataRelated: newColumn.value.isDataRelated,
      options:
        newColumn.value.type === "select" ? newColumn.value.options : null,
      rolePermissions: newColumnPermissions.value,
    });
    closeAddModal();
  } catch (error) {
    console.error("Failed to create column:", error);
  } finally {
    processingKey.value = null;
  }
}

// Edit Column Modal
async function openEditModal(column) {
  editingColumn.value = {
    ...column,
    options: column.options ? [...column.options] : [],
  };
  newOption.value = "";

  // Load current permissions for this column
  const perms = defaultPermissions();
  for (const role of [...configurableRoles, ...fixedRoles]) {
    const rolePerms =
      columnsStore.permissions[role.id]?.permissions?.[column.key];
    if (rolePerms) {
      perms[role.id] = {
        visible: rolePerms.visible ?? false,
        editable: rolePerms.editable ?? false,
        requiresApproval: rolePerms.requiresApproval ?? false,
      };
    }
  }
  editingColumnPermissions.value = perms;

  // Get data count for impact display
  editingColumnDataCount.value = await columnsStore.getColumnDataCount(
    column.key,
  );

  showEditModal.value = true;
}

function closeEditModal() {
  showEditModal.value = false;
  editingColumn.value = null;
  editingColumnDataCount.value = 0;
  editingColumnPermissions.value = defaultPermissions();
}

function addEditOption() {
  if (
    newOption.value.trim() &&
    !editingColumn.value.options.includes(newOption.value.trim())
  ) {
    editingColumn.value.options.push(newOption.value.trim());
    newOption.value = "";
  }
}

function removeEditOption(index) {
  editingColumn.value.options.splice(index, 1);
}

// Check if type change is allowed (T-DATA-005)
const canChangeType = computed(() => {
  if (!editingColumn.value) return false;
  // If not data-related, always allow
  if (!editingColumn.value.isDataRelated) return true;
  // If data-related but no data exists, allow
  if (editingColumnDataCount.value === 0) return true;
  // Otherwise, block type changes
  return false;
});

async function updateColumn() {
  if (!editingColumn.value) return;

  const original = columnsStore.definitions.find(
    (c) => c.key === editingColumn.value.key,
  );

  // T-DATA-005: Block type change if data-related and data exists
  if (
    original.isDataRelated &&
    editingColumn.value.type !== original.type &&
    editingColumnDataCount.value > 0
  ) {
    columnsStore.error =
      "Cannot change type of a data-related column when data exists.";
    return;
  }

  processingKey.value = editingColumn.value.key;
  try {
    const changes = {
      label: editingColumn.value.label,
      type: editingColumn.value.type,
      isDataRelated: editingColumn.value.isDataRelated,
    };

    if (editingColumn.value.type === "select") {
      changes.options = editingColumn.value.options;
    }

    await columnsStore.updateColumn(editingColumn.value.key, changes);

    // Update permissions for each role
    const columnKey = editingColumn.value.key;
    for (const role of [...configurableRoles, ...fixedRoles]) {
      const currentRolePerms =
        columnsStore.permissions[role.id]?.permissions || {};
      const updatedPerms = {
        ...currentRolePerms,
        [columnKey]: editingColumnPermissions.value[role.id],
      };
      await columnsStore.updateRolePermissions(role.id, updatedPerms);
    }

    closeEditModal();
  } catch (error) {
    console.error("Failed to update column:", error);
  } finally {
    processingKey.value = null;
  }
}

// Delete Column Modal
const clearingData = ref(false);

async function openDeleteModal(column) {
  deletingColumn.value = column;
  confirmDeleteKey.value = "";

  // Get data count for impact display
  deletingColumnDataCount.value = await columnsStore.getColumnDataCount(
    column.key,
  );

  showDeleteModal.value = true;
}

function closeDeleteModal() {
  showDeleteModal.value = false;
  deletingColumn.value = null;
  confirmDeleteKey.value = "";
  deletingColumnDataCount.value = 0;
}

async function clearColumnData() {
  if (!deletingColumn.value) return;

  clearingData.value = true;
  try {
    const clearedCount = await columnsStore.clearColumnData(
      deletingColumn.value.key,
    );
    // Refresh data count
    deletingColumnDataCount.value = await columnsStore.getColumnDataCount(
      deletingColumn.value.key,
    );
    // Data cleared successfully
  } catch (error) {
    console.error("Failed to clear column data:", error);
  } finally {
    clearingData.value = false;
  }
}

async function deleteColumn() {
  if (confirmDeleteKey.value !== deletingColumn.value.key) return;

  processingKey.value = deletingColumn.value.key;
  try {
    await columnsStore.deleteColumn(deletingColumn.value.key);
    closeDeleteModal();
  } catch (error) {
    console.error("Failed to delete column:", error);
  } finally {
    processingKey.value = null;
  }
}

// Drag and Drop
function onDragStart(index) {
  draggedIndex.value = index;
}

function onDragOver(event, index) {
  event.preventDefault();
  dragOverIndex.value = index;
}

function onDragLeave() {
  dragOverIndex.value = null;
}

async function onDrop(index) {
  if (draggedIndex.value === null || draggedIndex.value === index) {
    draggedIndex.value = null;
    dragOverIndex.value = null;
    return;
  }

  const columns = [...sortedColumns.value];
  const [draggedColumn] = columns.splice(draggedIndex.value, 1);
  columns.splice(index, 0, draggedColumn);

  // Get ordered keys (excluding system fields from reorder)
  const orderedKeys = columns.map((c) => c.key);

  savingOrder.value = true;
  try {
    await columnsStore.updateColumnOrder(orderedKeys);
  } catch (error) {
    console.error("Failed to update column order:", error);
  } finally {
    savingOrder.value = false;
    draggedIndex.value = null;
    dragOverIndex.value = null;
  }
}

function onDragEnd() {
  draggedIndex.value = null;
  dragOverIndex.value = null;
}

function getTypeLabel(type) {
  const labels = {
    text: "Text",
    number: "Number",
    date: "Date",
    select: "Select",
  };
  return labels[type] || type;
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Column Management</h2>
          <p class="text-gray-600 mt-1">
            Manage spreadsheet columns and their properties.
          </p>
        </div>
        <button
          @click="openAddModal"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Column
        </button>
      </div>
    </div>

    <!-- Error Banner -->
    <div
      v-if="columnsStore.error"
      class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
    >
      {{ columnsStore.error }}
    </div>

    <!-- Info Banner -->
    <div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div class="flex items-start gap-3">
        <svg
          class="w-5 h-5 text-blue-600 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div class="flex-1 text-sm text-blue-800">
          <p class="font-semibold">Drag and drop to reorder columns</p>
          <p class="mt-1">
            <strong>isDataRelated:</strong> If enabled, type changes are blocked
            when data exists (T-DATA-005). Disable for metadata-only columns
            like display order or labels (T-OPS-002).
          </p>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="columnsStore.loading" class="text-center py-12">
      <div class="inline-flex items-center text-gray-400">
        <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
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
        Loading columns...
      </div>
    </div>

    <!-- Column List -->
    <div
      v-else
      class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
    >
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="w-12 px-4 py-3"></th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Key
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Label
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Type
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Order
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Data Related
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                System
              </th>
              <th
                class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="(column, index) in sortedColumns"
              :key="column.key"
              draggable="true"
              @dragstart="onDragStart(index)"
              @dragover="onDragOver($event, index)"
              @dragleave="onDragLeave"
              @drop="onDrop(index)"
              @dragend="onDragEnd"
              :class="[
                'hover:bg-gray-50 transition-colors',
                dragOverIndex === index
                  ? 'bg-blue-50 border-t-2 border-blue-400'
                  : '',
                draggedIndex === index ? 'opacity-50' : '',
                column.systemField ? 'bg-gray-50' : 'cursor-move',
              ]"
            >
              <td class="px-4 py-4">
                <svg
                  v-if="!column.systemField"
                  class="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 8h16M4 16h16"
                  />
                </svg>
              </td>
              <td
                class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900"
              >
                {{ column.key }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ column.label }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span
                  :class="{
                    'bg-blue-100 text-blue-800': column.type === 'text',
                    'bg-green-100 text-green-800': column.type === 'number',
                    'bg-purple-100 text-purple-800': column.type === 'date',
                    'bg-orange-100 text-orange-800': column.type === 'select',
                  }"
                  class="px-2 py-1 rounded text-xs font-medium"
                >
                  {{ getTypeLabel(column.type) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                {{ column.order }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span
                  v-if="column.isDataRelated"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                >
                  Yes
                </span>
                <span v-else class="text-gray-400">No</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span
                  v-if="column.systemField"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700"
                >
                  System
                </span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td
                class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
              >
                <div class="flex items-center justify-end gap-2">
                  <button
                    v-if="!column.systemField"
                    @click="openEditModal(column)"
                    class="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    v-if="!column.systemField"
                    @click="openDeleteModal(column)"
                    class="text-red-600 hover:text-red-800 font-medium"
                  >
                    Delete
                  </button>
                  <span v-if="column.systemField" class="text-gray-400 text-xs">
                    Not editable
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Saving Order Indicator -->
    <div
      v-if="savingOrder"
      class="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
    >
      <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
      Saving order...
    </div>

    <!-- Add Column Modal -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeAddModal"
    >
      <div
        class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto"
      >
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Add New Column</h3>

        <div class="space-y-4">
          <!-- Key -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Key <span class="text-red-500">*</span>
            </label>
            <input
              v-model="newColumn.key"
              type="text"
              placeholder="column_key"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p v-if="keyError" class="mt-1 text-sm text-red-600">
              {{ keyError }}
            </p>
            <p v-else class="mt-1 text-xs text-gray-500">
              Lowercase letters, numbers, and underscores only
            </p>
          </div>

          <!-- Label -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Label <span class="text-red-500">*</span>
            </label>
            <input
              v-model="newColumn.label"
              type="text"
              placeholder="Column Label"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- Type -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Type <span class="text-red-500">*</span>
            </label>
            <select
              v-model="newColumn.type"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select (Dropdown)</option>
            </select>
          </div>

          <!-- Options for Select Type -->
          <div v-if="newColumn.type === 'select'">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Options <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2 mb-2">
              <input
                v-model="newOption"
                type="text"
                placeholder="Add option"
                @keyup.enter="addOption"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                @click="addOption"
                type="button"
                class="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Add
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(option, index) in newColumn.options"
                :key="index"
                class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
              >
                {{ option }}
                <button
                  @click="removeOption(index)"
                  class="text-gray-500 hover:text-red-600"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            </div>
            <p
              v-if="newColumn.options.length === 0"
              class="mt-1 text-sm text-red-600"
            >
              At least one option is required
            </p>
          </div>

          <!-- Is Data Related -->
          <div class="flex items-start gap-3">
            <input
              v-model="newColumn.isDataRelated"
              type="checkbox"
              id="isDataRelated"
              class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <label
                for="isDataRelated"
                class="text-sm font-medium text-gray-700"
              >
                Data Related
              </label>
              <p class="text-xs text-gray-500 mt-1">
                If enabled, type changes will be blocked when data exists in
                this column (T-DATA-005). Disable for metadata-only columns.
              </p>
            </div>
          </div>

          <!-- Role Permissions -->
          <div class="border-t pt-4 mt-4">
            <label class="block text-sm font-medium text-gray-700 mb-3">
              Role Permissions
            </label>
            <div class="space-y-3">
              <!-- Configurable roles (Jr/Sr Sales) -->
              <div
                v-for="role in configurableRoles"
                :key="role.id"
                class="bg-gray-50 rounded-lg p-3"
              >
                <div class="font-medium text-sm text-gray-800 mb-2">
                  {{ role.label }}
                </div>
                <div class="flex flex-wrap gap-4">
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      v-model="newColumnPermissions[role.id].visible"
                      type="checkbox"
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span class="text-gray-600">Visible</span>
                  </label>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      v-model="newColumnPermissions[role.id].editable"
                      type="checkbox"
                      :disabled="!newColumnPermissions[role.id].visible"
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                    <span
                      :class="
                        newColumnPermissions[role.id].visible
                          ? 'text-gray-600'
                          : 'text-gray-400'
                      "
                      >Editable</span
                    >
                  </label>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      v-model="newColumnPermissions[role.id].requiresApproval"
                      type="checkbox"
                      :disabled="!newColumnPermissions[role.id].editable"
                      class="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500 disabled:opacity-50"
                    />
                    <span
                      :class="
                        newColumnPermissions[role.id].editable
                          ? 'text-gray-600'
                          : 'text-gray-400'
                      "
                      >Requires Approval</span
                    >
                  </label>
                </div>
              </div>

              <!-- Fixed roles (Manager/Super Admin) - always full access -->
              <div
                v-for="role in fixedRoles"
                :key="role.id"
                class="bg-green-50 rounded-lg p-3 border border-green-200"
              >
                <div class="flex items-center justify-between">
                  <div class="font-medium text-sm text-gray-800">
                    {{ role.label }}
                  </div>
                  <span
                    class="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded"
                  >
                    Full Access
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-1">
                  Visible, Editable, No Approval Required
                </p>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-2">
              Manager and Super Admin always have full access. Configure
              permissions for Jr. and Sr. Sales.
            </p>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="closeAddModal"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            @click="createColumn"
            :disabled="!canCreateColumn || processingKey === 'new'"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <span v-if="processingKey === 'new'">Creating...</span>
            <span v-else>Create Column</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Column Modal -->
    <div
      v-if="showEditModal && editingColumn"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeEditModal"
    >
      <div
        class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto"
      >
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          Edit Column: {{ editingColumn.key }}
        </h3>

        <!-- Impact Notice -->
        <div
          v-if="editingColumnDataCount > 0"
          class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
        >
          <div class="flex items-start gap-2">
            <svg
              class="w-5 h-5 text-yellow-600 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div class="text-sm text-yellow-800">
              <strong>{{ editingColumnDataCount }}</strong> orders/costs use
              this column.
              <span v-if="editingColumn.isDataRelated">
                Type changes are blocked while data exists.
              </span>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <!-- Key (read-only) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Key</label
            >
            <input
              :value="editingColumn.key"
              type="text"
              disabled
              class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 font-mono text-gray-500"
            />
          </div>

          <!-- Label -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Label</label
            >
            <input
              v-model="editingColumn.label"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- Type -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Type</label
            >
            <select
              v-model="editingColumn.type"
              :disabled="!canChangeType"
              :class="[
                'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
                !canChangeType
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : '',
              ]"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select (Dropdown)</option>
            </select>
            <p v-if="!canChangeType" class="mt-1 text-xs text-red-600">
              Type changes blocked: data exists and column is data-related
              (T-DATA-005)
            </p>
          </div>

          <!-- Options for Select Type -->
          <div v-if="editingColumn.type === 'select'">
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Options</label
            >
            <div class="flex gap-2 mb-2">
              <input
                v-model="newOption"
                type="text"
                placeholder="Add option"
                @keyup.enter="addEditOption"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                @click="addEditOption"
                type="button"
                class="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Add
              </button>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(option, index) in editingColumn.options"
                :key="index"
                class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
              >
                {{ option }}
                <button
                  @click="removeEditOption(index)"
                  class="text-gray-500 hover:text-red-600"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            </div>
          </div>

          <!-- Is Data Related -->
          <div class="flex items-start gap-3">
            <input
              v-model="editingColumn.isDataRelated"
              type="checkbox"
              id="editIsDataRelated"
              class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <div>
              <label
                for="editIsDataRelated"
                class="text-sm font-medium text-gray-700"
              >
                Data Related
              </label>
              <p class="text-xs text-gray-500 mt-1">
                Disable to allow type changes even when data exists (T-OPS-002).
              </p>
            </div>
          </div>

          <!-- Role Permissions -->
          <div class="border-t pt-4 mt-4">
            <label class="block text-sm font-medium text-gray-700 mb-3">
              Role Permissions
            </label>
            <div class="space-y-3">
              <!-- Configurable roles (Jr/Sr Sales) -->
              <div
                v-for="role in configurableRoles"
                :key="role.id"
                class="bg-gray-50 rounded-lg p-3"
              >
                <div class="font-medium text-sm text-gray-800 mb-2">
                  {{ role.label }}
                </div>
                <div class="flex flex-wrap gap-4">
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      v-model="editingColumnPermissions[role.id].visible"
                      type="checkbox"
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span class="text-gray-600">Visible</span>
                  </label>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      v-model="editingColumnPermissions[role.id].editable"
                      type="checkbox"
                      :disabled="!editingColumnPermissions[role.id].visible"
                      class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                    <span
                      :class="
                        editingColumnPermissions[role.id].visible
                          ? 'text-gray-600'
                          : 'text-gray-400'
                      "
                      >Editable</span
                    >
                  </label>
                  <label class="flex items-center gap-2 text-sm">
                    <input
                      v-model="
                        editingColumnPermissions[role.id].requiresApproval
                      "
                      type="checkbox"
                      :disabled="!editingColumnPermissions[role.id].editable"
                      class="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500 disabled:opacity-50"
                    />
                    <span
                      :class="
                        editingColumnPermissions[role.id].editable
                          ? 'text-gray-600'
                          : 'text-gray-400'
                      "
                      >Requires Approval</span
                    >
                  </label>
                </div>
              </div>

              <!-- Fixed roles (Manager/Super Admin) - always full access -->
              <div
                v-for="role in fixedRoles"
                :key="role.id"
                class="bg-green-50 rounded-lg p-3 border border-green-200"
              >
                <div class="flex items-center justify-between">
                  <div class="font-medium text-sm text-gray-800">
                    {{ role.label }}
                  </div>
                  <span
                    class="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded"
                  >
                    Full Access
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-1">
                  Visible, Editable, No Approval Required
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="closeEditModal"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            @click="updateColumn"
            :disabled="processingKey === editingColumn.key"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <span v-if="processingKey === editingColumn.key">Saving...</span>
            <span v-else>Save Changes</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Column Modal -->
    <div
      v-if="showDeleteModal && deletingColumn"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeDeleteModal"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div class="flex items-start gap-3 mb-4">
          <div
            class="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"
          >
            <svg
              class="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">
              Delete Column
            </h3>
            <p class="text-sm text-red-600 font-semibold mb-3">
              Data in this column will be permanently lost!
            </p>
            <div class="bg-gray-50 rounded-lg p-3 mb-3 text-sm space-y-1">
              <div>
                <span class="font-medium">Key:</span> {{ deletingColumn.key }}
              </div>
              <div>
                <span class="font-medium">Label:</span>
                {{ deletingColumn.label }}
              </div>
              <div v-if="deletingColumnDataCount > 0" class="text-yellow-700">
                <span class="font-medium">⚠️ Affected records:</span>
                {{ deletingColumnDataCount }}
              </div>
            </div>

            <!-- Clear Data Button (if data exists) -->
            <div
              v-if="deletingColumnDataCount > 0"
              class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
            >
              <p class="text-sm text-yellow-800 mb-2">
                This column has data in
                <strong>{{ deletingColumnDataCount }}</strong> records. You must
                clear the data before deleting the column.
              </p>
              <button
                @click="clearColumnData"
                :disabled="clearingData"
                class="w-full px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <span v-if="clearingData">Clearing Data...</span>
                <span v-else>Clear All Data in This Column</span>
              </button>
              <p class="text-xs text-gray-600 mt-2">
                ⚠️ This will remove data from all orders/costs. Cannot be
                undone.
              </p>
            </div>

            <p class="text-sm text-gray-600 mb-3">
              To confirm deletion, type the column key below:
            </p>
            <input
              v-model="confirmDeleteKey"
              type="text"
              placeholder="Enter column key"
              :disabled="deletingColumnDataCount > 0"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p
              v-if="deletingColumnDataCount > 0"
              class="text-xs text-red-600 mt-1"
            >
              Clear data first to enable deletion
            </p>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <button
            @click="closeDeleteModal"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            @click="deleteColumn"
            :disabled="
              confirmDeleteKey !== deletingColumn.key ||
              processingKey === deletingColumn.key
            "
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <span v-if="processingKey === deletingColumn.key">Deleting...</span>
            <span v-else>Delete Column</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
