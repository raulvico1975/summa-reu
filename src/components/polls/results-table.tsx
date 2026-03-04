import { Table, TableWrap } from "@/src/components/ui/table";
import { ca } from "@/src/i18n/ca";

type Option = { id: string; label: string };
type VoteRow = { voterId: string; voterName: string; availabilityByOptionId: Record<string, boolean> };

export function ResultsTable({ options, rows }: { options: Option[]; rows: VoteRow[] }) {
  const totals = Object.fromEntries(options.map((option) => [option.id, 0]));

  rows.forEach((row) => {
    options.forEach((option) => {
      if (row.availabilityByOptionId[option.id]) {
        totals[option.id] += 1;
      }
    });
  });

  return (
    <TableWrap>
      <Table>
        <thead className="bg-slate-50">
          <tr>
            <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">{ca.poll.participant}</th>
            {options.map((option) => (
              <th key={option.id} className="border-b border-slate-200 px-3 py-2 text-left font-medium">
                {option.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.voterId}>
              <td className="border-b border-slate-100 px-3 py-2">{row.voterName}</td>
              {options.map((option) => (
                <td key={option.id} className="border-b border-slate-100 px-3 py-2">
                  {row.availabilityByOptionId[option.id] ? "✓" : "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50">
          <tr>
            <td className="px-3 py-2 font-medium">{ca.poll.totals}</td>
            {options.map((option) => (
              <td key={option.id} className="px-3 py-2 font-medium">
                {totals[option.id]}
              </td>
            ))}
          </tr>
        </tfoot>
      </Table>
    </TableWrap>
  );
}
