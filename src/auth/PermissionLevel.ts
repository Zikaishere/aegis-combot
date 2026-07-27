export enum PermissionLevel {
  None = 0,
  Moderator = 1,
  Administrator = 2,
  Owner = 3,
  Internal = 4,
}

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  [PermissionLevel.None]: "Operative",
  [PermissionLevel.Moderator]: "Moderator",
  [PermissionLevel.Administrator]: "Administrator",
  [PermissionLevel.Owner]: "Director",
  [PermissionLevel.Internal]: "AI Internal",
};

export function comparePermissions(actual: PermissionLevel, required: PermissionLevel): boolean {
  return actual >= required;
}
