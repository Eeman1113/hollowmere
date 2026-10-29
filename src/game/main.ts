import * as Phaser from 'phaser';
import { BootScene, TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { setFont } from './font';

export function startGame(parent: HTMLElement, fontFamily: string) {
  setFont(fontFamily);
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    backgroundColor: '#0b1016',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    scene: [BootScene, TitleScene, GameScene, UIScene],
    disableContextMenu: true,
  });
  (window as unknown as { __game: Phaser.Game }).__game = game;
  return game;
}
