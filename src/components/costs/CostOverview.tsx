"use client";

import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Calendar, TrendingUp } from "lucide-react";

interface CostOverviewProps {
  today: number;
  week: number;
  month: number;
}

export function CostOverview({ today, week, month }: CostOverviewProps) {
  const cards = [
    {
      title: "Today",
      value: today,
      icon: DollarSign,
      color: "text-green-400",
    },
    {
      title: "This Week",
      value: week,
      icon: Calendar,
      color: "text-blue-400",
    },
    {
      title: "This Month",
      value: month,
      icon: TrendingUp,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg bg-zinc-800`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-zinc-400">{card.title}</p>
                <p className="text-2xl font-bold text-zinc-100">
                  ${card.value.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
