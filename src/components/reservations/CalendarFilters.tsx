
import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

type Option = { id: string; nom: string };
type Props = {
  nomsResidences: Option[];
  typesAppartements: Option[];
  groupes: Option[];
  onChange: (filters: {
    nomResid: string | undefined;
    type: string | undefined;
    groupe: string | undefined;
    search: string;
  }) => void;
};

const initialState = {
  nomResid: undefined,
  type: undefined,
  groupe: undefined,
  search: ""
};

const CalendarFilters: React.FC<Props> = ({
  nomsResidences,
  typesAppartements,
  groupes,
  onChange
}) => {
  const [filters, setFilters] = useState(initialState);

  useEffect(() => {
    onChange(filters);
    // eslint-disable-next-line
  }, [filters.nomResid, filters.type, filters.groupe, filters.search]);

  const handleReset = () => {
    setFilters(initialState);
  };

  return (
    <div className="bg-white border p-4 rounded-xl mb-6 flex flex-col gap-4 md:flex-row md:items-end md:gap-8">
      <div className="flex flex-col w-full max-w-xs">
        <label className="mb-1 font-medium text-sm text-gray-700">Nom de la résidence</label>
        <Select
          value={filters.nomResid}
          onValueChange={(value) =>
            setFilters((f) => ({ ...f, nomResid: value === "all" ? undefined : value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Toutes les résidences" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les résidences</SelectItem>
            {nomsResidences.map((o) => (
              <SelectItem key={o.id} value={o.nom}>
                {o.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col w-full max-w-xs">
        <label className="mb-1 font-medium text-sm text-gray-700">Type</label>
        <Select
          value={filters.type}
          onValueChange={(value) =>
            setFilters((f) => ({ ...f, type: value === "all" ? undefined : value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Tous les types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {typesAppartements.map((o) => (
              <SelectItem key={o.id} value={o.nom}>
                {o.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col w-full max-w-xs">
        <label className="mb-1 font-medium text-sm text-gray-700">Groupe</label>
        <Select
          value={filters.groupe}
          onValueChange={(value) =>
            setFilters((f) => ({ ...f, groupe: value === "all" ? undefined : value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Tous les groupes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les groupes</SelectItem>
            {groupes.map((o) => (
              <SelectItem key={o.id} value={o.nom}>
                {o.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col w-full max-w-xs">
        <label className="mb-1 font-medium text-sm text-gray-700">Recherche (nom de propriété)</label>
        <div className="relative w-full">
          <Input
            type="text"
            placeholder="Tapez un nom…"
            className="pr-8"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <Search className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>
      <div className="flex flex-col w-full max-w-xs md:pl-2">
        <Button
          variant="outline"
          className="mt-auto"
          onClick={handleReset}
          type="button"
        >
          Réinitialiser les filtres
        </Button>
      </div>
    </div>
  );
};

export default CalendarFilters;
