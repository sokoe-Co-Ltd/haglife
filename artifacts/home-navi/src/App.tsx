import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router as WouterRouter } from "wouter";
import AppRouter from "./AppRouter";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { OfflineBanner } from "@/components/OfflineBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <OfflineProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <OfflineBanner />
            <AppRouter />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </OfflineProvider>
    </QueryClientProvider>
  );
}

export default App;
