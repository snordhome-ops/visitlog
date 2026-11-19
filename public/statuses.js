/* Visit statuses. Edit this list to add, rename or remove statuses.
   Each status belongs to a group; charts and totals use the groups, so the dashboard stays readable.
   g: visit | followup | sample | quote | sale | closed.  act: true = shows in "Follow-ups waiting".
   Keep "Visit only", "Follow-up", "Sample" and "Sale" so visits saved earlier still match. */
(function () {
  var GROUPS = [
    { id: 'visit', label: 'Visit only', color: 'var(--c-visit)' },
    { id: 'followup', label: 'Follow-up', color: 'var(--c-follow)' },
    { id: 'sample', label: 'Samples', color: 'var(--c-sample)' },
    { id: 'quote', label: 'Quotation', color: 'var(--c-quote)' },
    { id: 'sale', label: 'Sales', color: 'var(--c-sale)' },
    { id: 'closed', label: 'Lost / returned', color: 'var(--c-closed)' }
  ];
  var LIST = [
    { n: 'Visit only', g: 'visit' },
    { n: 'Follow-up', g: 'followup', act: true },
    { n: 'Interested, will decide', g: 'followup', act: true },
    { n: 'Payment pending', g: 'followup', act: true },
    { n: 'Sample provided', g: 'sample', act: true },
    { n: 'Sample to be sent', g: 'sample', act: true },
    { n: 'Sample returned', g: 'sample' },
    { n: 'Sample', g: 'sample' },
    { n: 'Quotation (SQ) issued', g: 'quote', act: true },
    { n: 'Sale – SQ issued', g: 'sale' },
    { n: 'Sale – SO issued', g: 'sale' },
    { n: 'Sale – advance received', g: 'sale' },
    { n: 'Sale – fully paid', g: 'sale' },
    { n: 'Sale – delivered', g: 'sale' },
    { n: 'Sale', g: 'sale' },
    { n: 'Return / refund', g: 'closed' },
    { n: 'Lost / not interested', g: 'closed' }
  ];
  var byName = {}; LIST.forEach(function (s) { byName[s.n] = s; });
  window.NHS = {
    LIST: LIST, GROUPS: GROUPS, names: LIST.map(function (s) { return s.n; }),
    group: function (n) { return (byName[n] && byName[n].g) || (/^sale/i.test(n || '') ? 'sale' : /sample/i.test(n || '') ? 'sample' : /follow/i.test(n || '') ? 'followup' : 'visit'); },
    isSale: function (n) { return window.NHS.group(n) === 'sale'; },
    needsAction: function (n) { return !!(byName[n] && byName[n].act); },
    groupLabel: function (id) { return GROUPS.filter(function (g) { return g.id === id; })[0].label; }
  };
})();
