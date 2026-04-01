import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader className="space-y-1">
          <h1 className="text-xl font-semibold">Pàgina no trobada</h1>
          <p className="text-sm text-slate-600">
            La pàgina que busques no existeix o ha estat moguda.
          </p>
          <p className="text-sm text-slate-500">
            La página que buscas no existe o ha sido movida.
          </p>
        </CardHeader>
        <CardContent>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
            Tornar a l&apos;inici / Volver al inicio
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
