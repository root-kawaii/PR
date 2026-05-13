import { useState, type FormEvent } from "react";
import { Plus, X, Pencil, Trash2 } from "lucide-react";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../context/AuthContext";
import { API_URL } from "../config/api";
import type { Area, TableResponse } from "../types";
import { EmptyState, PageHeader, SectionCard } from "../components/ui";
import { ui } from "../components/ui-classes";
import { trackEvent } from "../config/analytics";

interface AreaFormData {
  name: string;
  price: string;
  description: string;
}

const emptyAreaForm: AreaFormData = { name: "", price: "", description: "" };

interface TableFormData {
  areaId: string;
  name: string;
  capacity: string;
  locationDescription: string;
}

const emptyTableForm: TableFormData = {
  areaId: "",
  name: "",
  capacity: "",
  locationDescription: "",
};

function priceNumberFromString(price: string): string {
  // Backend returns prices as "12.00 €" — strip suffix to get a numeric
  // string suitable for an `<input type=number>` value.
  return price.replace(/[^0-9.,-]/g, "").replace(",", ".").trim();
}

export default function ClubAreasPage() {
  const {
    data: areas,
    loading: areasLoading,
    refetch: refetchAreas,
  } = useFetch<Area[]>("/owner/areas");
  const {
    data: tables,
    loading: tablesLoading,
    refetch: refetchTables,
  } = useFetch<TableResponse[]>("/owner/tables");
  const { token } = useAuth();

  const [showAreaForm, setShowAreaForm] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [areaForm, setAreaForm] = useState<AreaFormData>(emptyAreaForm);
  const [submittingArea, setSubmittingArea] = useState(false);

  const [showTableForm, setShowTableForm] = useState(false);
  const [editingTable, setEditingTable] = useState<TableResponse | null>(null);
  const [tableForm, setTableForm] = useState<TableFormData>(emptyTableForm);
  const [submittingTable, setSubmittingTable] = useState(false);

  const openCreateArea = () => {
    setEditingArea(null);
    setAreaForm(emptyAreaForm);
    setShowAreaForm(true);
  };

  const openEditArea = (area: Area) => {
    setEditingArea(area);
    setAreaForm({
      name: area.name,
      price: priceNumberFromString(area.price),
      description: area.description ?? "",
    });
    setShowAreaForm(true);
  };

  const closeAreaForm = () => {
    setShowAreaForm(false);
    setEditingArea(null);
    setAreaForm(emptyAreaForm);
  };

  const handleSubmitArea = async (e: FormEvent) => {
    e.preventDefault();
    setSubmittingArea(true);
    try {
      const body = {
        name: areaForm.name.trim(),
        price: parseFloat(areaForm.price),
        description: areaForm.description.trim() || undefined,
      };
      const url = editingArea
        ? `${API_URL}/owner/areas/${editingArea.id}`
        : `${API_URL}/owner/areas`;
      const method = editingArea ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(
          editingArea
            ? "Impossibile aggiornare l'area"
            : "Impossibile creare l'area",
        );
      }
      trackEvent(editingArea ? "owner_area_updated" : "owner_area_created", {
        area_name: body.name,
      });
      closeAreaForm();
      refetchAreas();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    } finally {
      setSubmittingArea(false);
    }
  };

  const handleDeleteArea = async (area: Area) => {
    if (
      !confirm(
        `Eliminare l'area "${area.name}"? L'area può essere eliminata solo se non contiene tavoli.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/owner/areas/${area.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 409) {
        throw new Error(
          "Impossibile eliminare l'area: contiene tavoli o è l'area predefinita.",
        );
      }
      if (!res.ok) {
        throw new Error("Impossibile eliminare l'area");
      }
      trackEvent("owner_area_deleted", { area_name: area.name });
      refetchAreas();
      refetchTables();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    }
  };

  const openCreateTable = (areaId?: string) => {
    setEditingTable(null);
    setTableForm({
      ...emptyTableForm,
      areaId: areaId ?? areas?.[0]?.id ?? "",
    });
    setShowTableForm(true);
  };

  const openEditTable = (table: TableResponse) => {
    setEditingTable(table);
    setTableForm({
      areaId: table.areaId ?? "",
      name: table.name,
      capacity: String(table.capacity),
      locationDescription: table.locationDescription ?? "",
    });
    setShowTableForm(true);
  };

  const closeTableForm = () => {
    setShowTableForm(false);
    setEditingTable(null);
    setTableForm(emptyTableForm);
  };

  const handleSubmitTable = async (e: FormEvent) => {
    e.preventDefault();
    setSubmittingTable(true);
    try {
      const url = editingTable
        ? `${API_URL}/owner/tables/${editingTable.id}`
        : `${API_URL}/owner/tables`;
      const method = editingTable ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        name: tableForm.name.trim(),
        capacity: parseInt(tableForm.capacity, 10),
        location_description: tableForm.locationDescription.trim() || undefined,
      };
      if (!editingTable) {
        body.area_id = tableForm.areaId;
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(
          editingTable
            ? "Impossibile aggiornare il tavolo"
            : "Impossibile creare il tavolo",
        );
      }
      trackEvent(editingTable ? "owner_table_updated" : "owner_table_created", {
        table_name: body.name,
      });
      closeTableForm();
      refetchTables();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    } finally {
      setSubmittingTable(false);
    }
  };

  const handleDeleteTable = async (table: TableResponse) => {
    if (!confirm(`Eliminare il tavolo "${table.name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`${API_URL}/owner/tables/${table.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 409) {
        throw new Error(
          "Impossibile eliminare il tavolo: ha prenotazioni attive.",
        );
      }
      if (!res.ok) {
        throw new Error("Impossibile eliminare il tavolo");
      }
      trackEvent("owner_table_deleted", { table_name: table.name });
      refetchTables();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    }
  };

  if (areasLoading || tablesLoading) {
    return <div className={ui.helperText}>Caricamento...</div>;
  }

  const areaList = areas ?? [];
  const tableList = tables ?? [];
  const tablesByArea = new Map<string, TableResponse[]>();
  for (const t of tableList) {
    if (!t.areaId) continue;
    const arr = tablesByArea.get(t.areaId) ?? [];
    arr.push(t);
    tablesByArea.set(t.areaId, arr);
  }

  return (
    <div>
      <PageHeader
        title="Aree e tavoli"
        description="Gestisci le aree del locale e i tavoli al loro interno. Aree e tavoli vengono riutilizzati automaticamente in ogni serata."
        action={
          <div className="flex gap-2">
            <button onClick={openCreateArea} className={ui.secondaryButton}>
              <Plus size={18} /> Nuova area
            </button>
            <button
              onClick={() => openCreateTable()}
              className={ui.primaryButton}
              disabled={areaList.length === 0}
              title={
                areaList.length === 0
                  ? "Crea prima un'area"
                  : undefined
              }
            >
              <Plus size={18} /> Nuovo tavolo
            </button>
          </div>
        }
      />

      {!areaList.length ? (
        <EmptyState
          title="Nessuna area configurata"
          description="Crea la prima area del tuo locale per iniziare a gestire i tavoli."
          action={
            <button onClick={openCreateArea} className={ui.primaryButton}>
              <Plus size={18} /> Crea area
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {areaList.map((area) => {
            const tablesInArea = tablesByArea.get(area.id) ?? [];
            return (
              <SectionCard key={area.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {area.name}
                    </h2>
                    <p className={ui.helperText}>
                      Prezzo a persona: {area.price}
                    </p>
                    {area.description && (
                      <p className="text-sm text-gray-500 mt-1">
                        {area.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openCreateTable(area.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    >
                      <Plus size={13} /> Tavolo
                    </button>
                    <button
                      onClick={() => openEditArea(area)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    >
                      <Pencil size={13} /> Modifica
                    </button>
                    <button
                      onClick={() => handleDeleteArea(area)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={13} /> Elimina
                    </button>
                  </div>
                </div>

                {!tablesInArea.length ? (
                  <p className="text-sm text-gray-400">
                    Nessun tavolo in questa area.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className={ui.tableHeader}>Nome</th>
                          <th className={ui.tableHeader}>Capienza</th>
                          <th className={ui.tableHeader}>Min spend (€/p)</th>
                          <th className={ui.tableHeader}>Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tablesInArea.map((t) => (
                          <tr key={t.id} className={ui.tableRow}>
                            <td className={ui.tableCell + " font-medium text-gray-900"}>
                              {t.name}
                            </td>
                            <td className={ui.tableCell}>{t.capacity}</td>
                            <td className={ui.tableCell + " text-gray-500"}>{area.price}</td>
                            <td className={ui.tableCell}>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openEditTable(t)}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                                >
                                  <Pencil size={13} /> Modifica
                                </button>
                                <button
                                  onClick={() => handleDeleteTable(t)}
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 size={13} /> Elimina
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}

      {showAreaForm && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalPanel}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editingArea ? "Modifica area" : "Nuova area"}
              </h2>
              <button onClick={closeAreaForm} className={ui.iconButton}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitArea} className="space-y-4">
              <div>
                <label className={ui.label}>Nome *</label>
                <input
                  value={areaForm.name}
                  onChange={(e) =>
                    setAreaForm({ ...areaForm, name: e.target.value })
                  }
                  required
                  placeholder="es. VIP, Pista, Terrazza"
                  className={ui.input}
                />
              </div>
              <div>
                <label className={ui.label}>Prezzo a persona (€) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={areaForm.price}
                  onChange={(e) =>
                    setAreaForm({ ...areaForm, price: e.target.value })
                  }
                  required
                  className={ui.input}
                />
              </div>
              <div>
                <label className={ui.label}>Descrizione</label>
                <textarea
                  value={areaForm.description}
                  onChange={(e) =>
                    setAreaForm({ ...areaForm, description: e.target.value })
                  }
                  rows={3}
                  className={ui.textarea}
                />
              </div>
              <button
                type="submit"
                disabled={submittingArea}
                className={`${ui.primaryButton} w-full`}
              >
                {submittingArea
                  ? editingArea
                    ? "Salvataggio..."
                    : "Creazione..."
                  : editingArea
                    ? "Salva modifiche"
                    : "Crea area"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showTableForm && (
        <div className={ui.modalOverlay}>
          <div className={ui.modalPanel}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editingTable ? "Modifica tavolo" : "Nuovo tavolo"}
              </h2>
              <button onClick={closeTableForm} className={ui.iconButton}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitTable} className="space-y-4">
              {!editingTable && (
                <div>
                  <label className={ui.label}>Area *</label>
                  <select
                    value={tableForm.areaId}
                    onChange={(e) =>
                      setTableForm({ ...tableForm, areaId: e.target.value })
                    }
                    required
                    className={`${ui.select} w-full`}
                  >
                    <option value="">Seleziona area</option>
                    {areaList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={ui.label}>Nome *</label>
                <input
                  value={tableForm.name}
                  onChange={(e) =>
                    setTableForm({ ...tableForm, name: e.target.value })
                  }
                  required
                  placeholder="es. VIP-01"
                  className={ui.input}
                />
              </div>
              <div>
                <label className={ui.label}>Capienza *</label>
                <input
                  type="number"
                  min="1"
                  value={tableForm.capacity}
                  onChange={(e) =>
                    setTableForm({ ...tableForm, capacity: e.target.value })
                  }
                  required
                  className={ui.input}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Il min spend del tavolo è ereditato dal prezzo dell'area.
                </p>
              </div>
              <div>
                <label className={ui.label}>Descrizione posizione</label>
                <input
                  value={tableForm.locationDescription}
                  onChange={(e) =>
                    setTableForm({
                      ...tableForm,
                      locationDescription: e.target.value,
                    })
                  }
                  className={ui.input}
                />
              </div>
              <button
                type="submit"
                disabled={submittingTable}
                className={`${ui.primaryButton} w-full`}
              >
                {submittingTable
                  ? editingTable
                    ? "Salvataggio..."
                    : "Creazione..."
                  : editingTable
                    ? "Salva modifiche"
                    : "Crea tavolo"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
