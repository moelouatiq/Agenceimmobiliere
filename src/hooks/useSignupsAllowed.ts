// Signups are always allowed. This hook is kept as a no-op stub
// so existing imports continue to work without any database lookups.
export function useSignupsAllowed() {
  return {
    signupsAllowed: true as boolean,
    isLoading: false,
    checkSignupsAllowed: async () => {},
  };
}

export default useSignupsAllowed;
