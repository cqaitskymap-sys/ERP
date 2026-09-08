"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MasterPage } from "@/components/masters/master-page";

export default function UomMasterPage() {
  return (
    <Tabs defaultValue="uoms" className="space-y-4">
      <TabsList>
        <TabsTrigger value="uoms">Units</TabsTrigger>
        <TabsTrigger value="conversions">Conversions</TabsTrigger>
      </TabsList>
      <TabsContent value="uoms">
        <MasterPage entity="uoms" />
      </TabsContent>
      <TabsContent value="conversions">
        <MasterPage
          entity="uomConversions"
          title="UOM conversions"
          description="Conversions are applied only when an explicit rule exists. Example: 1 KG = 1000 G."
        />
      </TabsContent>
    </Tabs>
  );
}
