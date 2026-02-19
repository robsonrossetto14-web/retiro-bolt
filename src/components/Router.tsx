import { createContext, useContext } from 'react';

type RouterContextType = {
  path: string;
  params: Record<string, string>;
};

const RouterContext = createContext<RouterContextType>({ path: '/', params: {} });

export function useParams() {
  const { params } = useContext(RouterContext);
  return params;
}

export function Router({ children }: { children: React.ReactNode }) {
  const path = window.location.pathname;
  const params: Record<string, string> = {};

  const inscricaoMatch = path.match(/^\/inscricao\/(.+)$/);
  if (inscricaoMatch) {
    params.shareLink = inscricaoMatch[1];
  }

  const approveAccountMatch = path.match(/^\/aprovar-conta\/(.+)$/);
  if (approveAccountMatch) {
    params.approvalToken = approveAccountMatch[1];
  }

  return (
    <RouterContext.Provider value={{ path, params }}>
      {children}
    </RouterContext.Provider>
  );
}
