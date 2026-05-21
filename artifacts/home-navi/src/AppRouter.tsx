import { Switch, Route } from "wouter";
import Dashboard from "./pages/dashboard";
import HandoverList from "./pages/handover";
import HandoverNew from "./pages/handover/new";
import HandoverDetail from "./pages/handover/detail";
import VitalsList from "./pages/vitals";
import VitalsNew from "./pages/vitals/new";
import MealsList from "./pages/meals";
import MealsRecordsIndex from "./pages/meals/records/index";
import ResidentMealHistory from "./pages/meals/records/[residentId]";
import MealFoodForms from "./pages/meals/food-forms";
import WeightsList from "./pages/weights";
import WeightsNew from "./pages/weights/new";
import WeightGraphList from "./pages/weights/graph/index";
import WeightGraphDetail from "./pages/weights/graph/[id]";
import EliminationsList from "./pages/eliminations";
import EliminationsNew from "./pages/eliminations/new";
import DayServicesList from "./pages/day-services";
import BathReportsList from "./pages/bath-reports";
import BathReportsNew from "./pages/bath-reports/new";
import BathReportDetail from "./pages/bath-reports/detail";
import ResidentsList from "./pages/residents";
import ResidentsNew from "./pages/residents/new";
import ResidentDetail from "./pages/residents/detail";
import MovedOutList from "./pages/residents/moved-out";
import MovedOutDetail from "./pages/residents/moved-out-detail";
import StaffList from "./pages/staff";
import StaffNew from "./pages/staff/new";
import StaffDetail from "./pages/staff/detail";
import HealthDetail from "./pages/health/detail";
import SettingsPage from "./pages/settings";
import RouteSheetPage from "./pages/route-sheet/index";
import ServiceTypesPage from "./pages/service-types";
import ShiftTypesPage from "./pages/shift-types";
import ShiftsPage from "./pages/shifts";
import RouteSheetTemplatesPage from "./pages/route-sheet-templates";
import { Layout } from "./components/layout";

const PlaceholderPage = ({ title }: { title: string }) => (
  <Layout>
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <p className="text-muted-foreground">開発中...</p>
    </div>
  </Layout>
);

export default function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/handover" component={HandoverList} />
      <Route path="/handover/new" component={HandoverNew} />
      <Route path="/handover/:id" component={HandoverDetail} />
      <Route path="/vitals" component={VitalsList} />
      <Route path="/vitals/:residentId" component={VitalsNew} />
      <Route path="/meals" component={MealsList} />
      <Route path="/meals/records" component={MealsRecordsIndex} />
      <Route path="/meals/records/:residentId" component={ResidentMealHistory} />
      <Route path="/meals/food-forms" component={MealFoodForms} />
      <Route path="/weights" component={WeightsList} />
      <Route path="/weights/graph" component={WeightGraphList} />
      <Route path="/weights/graph/:id" component={WeightGraphDetail} />
      <Route path="/weights/:residentId" component={WeightsNew} />
      <Route path="/eliminations" component={EliminationsList} />
      <Route path="/eliminations/:residentId" component={EliminationsNew} />
      <Route path="/day-services" component={DayServicesList} />
      <Route path="/bath-reports" component={BathReportsList} />
      <Route path="/bath-reports/new" component={BathReportsNew} />
      <Route path="/bath-reports/:id" component={BathReportDetail} />
      <Route path="/residents" component={ResidentsList} />
      <Route path="/residents/new" component={ResidentsNew} />
      <Route path="/residents/moved-out" component={MovedOutList} />
      <Route path="/residents/moved-out/:id" component={MovedOutDetail} />
      <Route path="/residents/:id" component={ResidentDetail} />
      <Route path="/staff" component={StaffList} />
      <Route path="/staff/new" component={StaffNew} />
      <Route path="/staff/:id" component={StaffDetail} />
      <Route path="/health/:id" component={HealthDetail} />
      <Route path="/route-sheet" component={RouteSheetPage} />
      <Route path="/service-types" component={ServiceTypesPage} />
      <Route path="/shift-types" component={ShiftTypesPage} />
      <Route path="/shifts" component={ShiftsPage} />
      <Route path="/route-sheet-templates" component={RouteSheetTemplatesPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={() => <PlaceholderPage title="見つかりません" />} />
    </Switch>
  );
}
