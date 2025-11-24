import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { SectionCards } from "@/admin/components/section-cards";
import { ChartAreaInteractive } from "@/admin/components/chart-area-interactive";
import { DataTable } from "@/admin/components/data-table";
import data from "./data.json";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: () => (
    <div className="flex flex-1 flex-col">
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <SectionCards />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
        <DataTable data={data} />
      </div>
    </div>
  </div>
  ),
});

