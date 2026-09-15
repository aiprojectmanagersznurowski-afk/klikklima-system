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
  type BookingSubject,
  type CreateBookingParams,
  type CreateBookingErrorCode,
  type BookingRow,
  type CreateBookingResult,
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
