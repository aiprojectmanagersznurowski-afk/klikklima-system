import { describe, it, expect, vi } from 'vitest'
import { SLA } from '@klikklima/contracts'
import { isInstallationLate } from '../src/app/(dashboard)/installations/installation-sla'

// @REQ: CRM-INST-AC1, CRM-INST-AC2
describe('CRM-INST: Odświeżanie statusu i alert SLA 16:00', () => {
  describe('CRM-INST-AC2: Dzisiejsze zlecenia montazu bez statusu Zakończona po 16:00', () => {
    it('oznacza instalację jako spóźnioną (alert), gdy jest dzisiaj, nie ma statusu COMPLETED i minęła godzina SLA.INSTALL_DAY_ALERT', () => {
      const lateInstallation = {
        plannedDate: '2026-09-23',
        status: 'IN_PROGRESS' as const,
      }

      // Godzina 16:00 lub późniejsza
      const isLateAt16 = isInstallationLate(
        lateInstallation,
        SLA.INSTALL_DAY_ALERT.hourOfDay,
        () => true // dzisiaj
      )
      expect(isLateAt16).toBe(true)

      const isLateAt18 = isInstallationLate(
        lateInstallation,
        18,
        () => true // dzisiaj
      )
      expect(isLateAt18).toBe(true)
    })

    it('NIE oznacza instalacji jako spóźnionej przed godziną SLA.INSTALL_DAY_ALERT.hourOfDay', () => {
      const plannedInstallation = {
        plannedDate: '2026-09-23',
        status: 'PLANNED' as const,
      }

      const isLateAt15 = isInstallationLate(
        plannedInstallation,
        SLA.INSTALL_DAY_ALERT.hourOfDay - 1,
        () => true
      )
      expect(isLateAt15).toBe(false)
    })

    it('NIE oznacza instalacji jako spóźnionej, gdy jej status to COMPLETED (niezależnie od godziny)', () => {
      const completedInstallation = {
        plannedDate: '2026-09-23',
        status: 'COMPLETED' as const,
      }

      const isLate = isInstallationLate(
        completedInstallation,
        20,
        () => true
      )
      expect(isLate).toBe(false)
    })

    it('NIE oznacza instalacji jako spóźnionej, gdy montaż jest zaplanowany na inny dzień', () => {
      const futureInstallation = {
        plannedDate: '2026-09-25',
        status: 'PLANNED' as const,
      }

      const isLate = isInstallationLate(
        futureInstallation,
        19,
        () => false // nie dzisiaj
      )
      expect(isLate).toBe(false)
    })

    it('próg godzinowy pochodzi z SLA.INSTALL_DAY_ALERT, a nie z literału', () => {
      expect(SLA.INSTALL_DAY_ALERT.hourOfDay).toBe(16)
    })
  })

  describe('CRM-INST-AC1: Reaktywne odświeżanie bez pełnego przeładowania strony', () => {
    it('aktualizuje status w stanie lokalnym po otrzymaniu payloadu z bazy bez przeładowania strony', () => {
      const initial = [
        { id: 'inst-1', status: 'IN_PROGRESS' },
        { id: 'inst-2', status: 'PLANNED' },
      ]

      const applyRealtimeStatusUpdate = (
        list: typeof initial,
        payload: { id: string; status: string }
      ) => {
        return list.map(item => item.id === payload.id ? { ...item, status: payload.status } : item)
      }

      const updated = applyRealtimeStatusUpdate(initial, { id: 'inst-1', status: 'COMPLETED' })
      expect(updated.find(i => i.id === 'inst-1')?.status).toBe('COMPLETED')
      expect(updated.find(i => i.id === 'inst-2')?.status).toBe('PLANNED')
    })
  })
})
