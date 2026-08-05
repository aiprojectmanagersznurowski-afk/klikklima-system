"use client";

import React from 'react';
import { Search, Plus } from 'lucide-react';

interface TopBarProps {
  title: string;
  subtitle: string;
  buttonText: string;
  searchValue: string;
  onSearchChange: (val: string) => void;
  onAddClick: () => void;
}

export function TopBar({ title, subtitle, buttonText, searchValue, onSearchChange, onAddClick }: TopBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm transition-shadow w-full sm:w-64"
            placeholder="Szukaj audytora..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <button
          onClick={onAddClick}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          {buttonText}
        </button>
      </div>
    </div>
  );
}
