import React from 'react';
import { Search, Plus } from 'lucide-react';

interface TopBarProps {
  onAddClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function TopBar({ onAddClick, searchQuery, onSearchChange }: TopBarProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between font-['Inter']">
      <h1 className="text-2xl font-semibold text-gray-900">Audytorzy</h1>
      
      <div className="flex items-center space-x-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
            placeholder="Szukaj po nazwisku, mieście..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        
        <button
          onClick={onAddClick}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Dodaj Audytora</span>
        </button>
      </div>
    </header>
  );
}
