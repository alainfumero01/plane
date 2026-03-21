import { Links, Meta, Outlet, Scripts } from "react-router";
import type { LinksFunction } from "react-router";
import globalStyles from "@/styles/global.css?url";
import { AppProviders } from "./providers";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: globalStyles }];

export const meta = () => [
  { title: "AIDA | Wind Blade Management Platform" },
  {
    name: "description",
    content: "Browser-first wind repair operations and project execution platform for enterprise multi-tenant use.",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}
