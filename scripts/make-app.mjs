// Copie le jeu (fichier unique) à la racine sous le nom Paddock.html
import { copyFileSync, statSync } from 'node:fs';
copyFileSync('dist-app/index.html', 'Paddock.html');
console.log(`Paddock.html prêt (${(statSync('Paddock.html').size / 1024 / 1024).toFixed(2)} Mo) : double-clique dessus pour jouer.`);
