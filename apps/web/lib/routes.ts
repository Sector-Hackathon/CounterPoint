/** Pages that live inside the signed-in workspace shell, where the public header is hidden. */
export const isWorkspacePath = (pathname: string) =>
  pathname === '/check' || pathname === '/history' || pathname === '/integrations' || pathname.startsWith('/t/');
