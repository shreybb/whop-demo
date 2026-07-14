/** POSTs to the signout route; plain form so it works without client JS. */
export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Sign out
      </button>
    </form>
  );
}
