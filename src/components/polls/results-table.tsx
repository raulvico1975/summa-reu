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
    <div className="space-y-3">
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? <p className="text-sm text-slate-600">{ca.poll.noVotesYet}</p> : null}
        {rows.map((row) => (
          <article key={row.voterId} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <p className="break-words text-sm font-semibold text-slate-900">{row.voterName}</p>
            <ul className="space-y-1.5">
              {options.map((option) => (
                <li key={option.id} className="flex items-start justify-between gap-3 text-xs text-slate-700">
                  <span className="min-w-0 break-words">{option.label}</span>
                  <span className="shrink-0 font-semibold">
                    {row.availabilityByOptionId[option.id] ? "✓" : "-"}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}

        <article className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-900">{ca.poll.totals}</p>
          <ul className="space-y-1.5">
            {options.map((option) => (
              <li key={option.id} className="flex items-start justify-between gap-3 text-xs text-slate-700">
                <span className="min-w-0 break-words">{option.label}</span>
                <span className="shrink-0 font-semibold">{totals[option.id]}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <TableWrap className="hidden md:block">
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2 text-left font-medium">{ca.poll.participant}</th>
              {options.map((option) => (
                <th key={option.id} className="border-b border-slate-200 px-3 py-2 text-left font-medium">
                  <span className="break-words">{option.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.voterId}>
                <td className="border-b border-slate-100 px-3 py-2 break-words">{row.voterName}</td>
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
    </div>
  );
}
