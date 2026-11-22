/** Médias fictifs du paddock. */
export interface Outlet {
  id: string;
  name: string;
  country: string;
  tone: 'serious' | 'tabloid' | 'tech' | 'fan' | 'tv';
  journalists: string[];
}

export const OUTLETS: Outlet[] = [
  { id: 'gpinsider', name: 'GP Insider', country: 'GB', tone: 'serious', journalists: ['Andrew Benson-Hale', 'Claire Whitmore'] },
  { id: 'pitlane', name: 'Pitlane Daily', country: 'GB', tone: 'tabloid', journalists: ['Danny Rourke', 'Kelly Marsh'] },
  { id: 'autohebdo', name: 'Vitesse Hebdo', country: 'FR', tone: 'serious', journalists: ['Julien Faure', 'Margaux Lemaire'] },
  { id: 'paddockmag', name: 'Paddock Magazine', country: 'IT', tone: 'serious', journalists: ['Giulia Ferraro', 'Paolo Ricci'] },
  { id: 'techf1', name: 'Downforce Tech', country: 'DE', tone: 'tech', journalists: ['Markus Engel'] },
  { id: 'gridtv', name: 'Grid TV', country: 'GB', tone: 'tv', journalists: ['Natalie Cross', 'Ted K.', 'Martin Blunt'] },
  { id: 'canalvitesse', name: 'Canal Vitesse', country: 'FR', tone: 'tv', journalists: ['Laurent Duchêne', 'Romain Belair'] },
  { id: 'fanzone', name: 'FanZone F1', country: 'US', tone: 'fan', journalists: ['Jordan Blake'] },
  { id: 'boxbox', name: 'Box Box Podcast', country: 'GB', tone: 'fan', journalists: ['Sam & Rory'] },
];

export const OUTLETS_BY_ID = Object.fromEntries(OUTLETS.map((o) => [o.id, o]));

export const FAN_NAMES = [
  'f1_obsessed', 'tifosi_forever', 'papaya_queen', 'orange_army_nl', 'box_box_boxx', 'pitwall_poet', 'undercut_king', 'drs_train',
  'grid_girl_lena', 'sunday_racer', 'apex_hunter', 'karting_kid07', 'sector3_purple', 'monza_magic', 'lights_out_lou', 'tyre_whisperer',
  'paddock_gossip', 'mclaren_mum', 'checo_nation', 'vamos_nano', 'hulk_smash_fan', 'bottas_mullet', 'kimi_fanpage', 'redline_rookie',
];
