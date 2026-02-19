import * as MailComposer from 'expo-mail-composer';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { type MatchCategory, type MatchDocument, type TournamentDocument } from '@/lib/firestore/types';

type CategoryGroup = {
  category: MatchCategory;
  matches: MatchDocument[];
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getWinnerName(match: MatchDocument): string {
  if (!match.winnerId) return 'TBD';
  if (match.winnerId === match.player1Id) return match.player1Name;
  if (match.winnerId === match.player2Id) return match.player2Name;
  return 'TBD';
}

function summarizeFinalScore(match: MatchDocument): string {
  const completedGames = match.scores.filter((game) => game.winner !== null);
  if (completedGames.length === 0) return '-';
  return completedGames.map((game) => `${game.p1Score}-${game.p2Score}`).join(', ');
}

function groupMatchesByCategory(matches: MatchDocument[]): CategoryGroup[] {
  const groups = new Map<MatchCategory, MatchDocument[]>();

  matches.forEach((match) => {
    if (!groups.has(match.category)) groups.set(match.category, []);
    groups.get(match.category)?.push(match);
  });

  return Array.from(groups.entries()).map(([category, groupedMatches]) => ({
    category,
    matches: groupedMatches,
  }));
}

function buildCategoryTable(group: CategoryGroup): string {
  const sortedMatches = [...group.matches].sort((a, b) => {
    const roundOrder: Record<string, number> = {
      group: 1,
      R16: 2,
      QF: 3,
      SF: 4,
      F: 5,
      '3rd': 6,
    };

    const left = roundOrder[a.round] ?? 99;
    const right = roundOrder[b.round] ?? 99;
    if (left !== right) return left - right;
    return a.player1Name.localeCompare(b.player1Name);
  });

  const rows = sortedMatches
    .map((match) => {
      const p1 = escapeHtml(match.player1Name);
      const p2 = escapeHtml(match.player2Name);
      const round = escapeHtml(match.round);
      const winner = escapeHtml(getWinnerName(match));
      const score = escapeHtml(summarizeFinalScore(match));

      return `<tr>
        <td>${round}</td>
        <td>${p1} vs ${p2}</td>
        <td>${winner}</td>
        <td>${score}</td>
      </tr>`;
    })
    .join('');

  return `
    <section class="category">
      <h2>${escapeHtml(group.category)}</h2>
      <table>
        <thead>
          <tr>
            <th>Round</th>
            <th>Match</th>
            <th>Winner</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4">No matches yet</td></tr>'}
        </tbody>
      </table>
    </section>
  `;
}

export function buildResultsHTML(tournament: TournamentDocument, matches: MatchDocument[]): string {
  const completedMatches = matches.filter((match) => match.status === 'completed');
  const grouped = groupMatchesByCategory(completedMatches);

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(tournament.name)} Results</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        padding: 20px;
        color: #0f172a;
      }
      h1 {
        color: #1B5E20;
        margin-bottom: 4px;
      }
      .meta {
        margin-top: 0;
        color: #475569;
        margin-bottom: 16px;
      }
      .category {
        margin-bottom: 22px;
      }
      h2 {
        color: #166534;
        margin: 0 0 10px 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th {
        background: #1B5E20;
        color: #ffffff;
        padding: 8px;
        text-align: left;
      }
      td {
        padding: 8px;
        border: 1px solid #d1d5db;
      }
      tr:nth-child(even) {
        background: #f8fafc;
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(tournament.name)}</h1>
    <p class="meta">Generated: ${new Date().toLocaleString()}</p>
    ${grouped.length > 0 ? grouped.map((group) => buildCategoryTable(group)).join('') : '<p>No completed matches yet.</p>'}
  </body>
</html>`;
}

export async function generateResultsPDF(
  tournament: TournamentDocument,
  matches: MatchDocument[],
): Promise<string> {
  const html = buildResultsHTML(tournament, matches);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

export async function shareResultsPDF(
  tournament: TournamentDocument,
  matches: MatchDocument[],
): Promise<string> {
  const uri = await generateResultsPDF(tournament, matches);
  const canShare = await Sharing.isAvailableAsync();

  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${tournament.name} Results`,
      UTI: 'com.adobe.pdf',
    });
  }

  return uri;
}

export async function emailResultsPDF(
  tournament: TournamentDocument,
  matches: MatchDocument[],
): Promise<string> {
  const uri = await generateResultsPDF(tournament, matches);
  const canEmail = await MailComposer.isAvailableAsync();

  if (canEmail) {
    await MailComposer.composeAsync({
      subject: `Results: ${tournament.name}`,
      body: 'Please find the tournament results attached.',
      attachments: [uri],
    });
  }

  return uri;
}
