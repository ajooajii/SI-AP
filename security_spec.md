# Security Specification - SI-AP

## Data Invariants
1. **Users**: Every user must have a unique profile. Only admins can change roles.
2. **Trips**: A trip record must have a valid date, vehicle, driver, and creator. `tonnage` and `volume` must be numbers.
3. **Master Data**: Vehicles, Drivers, UPTs, TPAs, and TPS can only be managed by Admins or Co-Admins.
4. **Settings**: Global settings can only be modified by Admins or Co-Admins.

## The Dirty Dozen Payloads (Targeting SI-AP)
1. **Identity Spoofing**: Attempt to create a trip with `createdBy` set to another user's UID.
2. **Privilege Escalation**: A standard user attempting to update their own `role` to 'admin'.
3. **Orphaned Writes**: Creating a trip with a non-existent TPA name (Relational check).
4. **Shadow Fields**: Updating a vehicle with an extra `isVerified: true` field not in the schema.
5. **State Shortcutting**: Deleting a trip record as a standard user.
6. **Resource Poisoning**: Injecting a 1MB string into the `vehiclePlate` field.
7. **Type Mismatch**: Sending `tonnage` as a string instead of a number.
8. **PII Leak**: A signed-in user attempting to list ALL user profiles without admin rights.
9. **Timestamp Manipulation**: Sending a manual `timestamp` instead of `request.time`.
10. **ID Poisoning**: Attempting to create a document with an ID that is a very long junk string.
11. **Bulk Delete**: Attempting to delete a collection via broad list permissions (though delete is usually per-doc).
12. **Settings Hijack**: A standard user updating `isTpaLocked` in global settings.

## Test Runner (Conceptual)
All the above payloads MUST return `PERMISSION_DENIED`.
