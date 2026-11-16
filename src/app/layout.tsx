import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { DialogHost } from "./dialogs";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Planner Tasks",
  description: "Kanban colaborativo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <DialogHost />
      </body>
    </html>
  );
}
