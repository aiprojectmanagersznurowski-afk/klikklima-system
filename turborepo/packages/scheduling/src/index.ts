// Publiczne API modułu domenowego kalendarza (@repo/scheduling).
// Reguły dostępności, wyliczanie wolnych terminów, rezerwacje i przepisanie rezerwacji.

export { availabilityRuleSchema, type AvailabilityRuleInput } from "./availability-rule-schema"

export {
  writeAvailabilityRuleRaw,
  type WriteAvailabilityRuleParams,
  type AvailabilityRuleRow,
} from "./availability-rule"

export {
  findAvailableSlots,
  type AvailableSlot,
  type ResourceSlots,
  type AvailableSlotsResult,
} from "./available-slots"

export {
  createBooking,
  extractSqlState,
  prepareBookingCandidates,
  writeBookingCandidate,
  type BookingSubject,
  type CreateBookingParams,
  type CreateBookingErrorCode,
  type BookingRow,
  type CreateBookingResult,
  type BookingCandidate,
  type PrepareBookingCandidatesParams,
  type PrepareBookingCandidatesResult,
  type WriteBookingCandidateParams,
  type WriteBookingCandidateResult,
} from "./create-booking"

export {
  getEffectiveAvailability,
  type EffectiveAvailabilityDay,
  type EffectiveAvailabilityResult,
} from "./effective-availability"

export { findPoolSlots, type PoolSlotsResult } from "./pool-slots"

export {
  reassignBooking,
  type ReassignBookingParams,
  type ReassignBookingErrorCode,
  type ReassignBookingResult,
} from "./reassign-booking"

export {
  createCrewAbsence,
  VALID_ABSENCE_REASONS,
  type AbsenceReason,
  type CreateCrewAbsenceParams,
  type CreateCrewAbsenceResult,
  type ConflictingBookingReport,
} from "./absence"
