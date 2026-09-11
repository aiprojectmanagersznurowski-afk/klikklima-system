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
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-card shadow-xs transition-shadow sm:w-64 text-foreground"
            placeholder="Szukaj audytora..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <button
          onClick={onAddClick}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-xs text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-2" />
          {buttonText}
        </button>
      </div>
    </div>
  );
}
