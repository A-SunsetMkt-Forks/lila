import { botAssetUrl } from 'lib/bot/botLoader';
import { bind, looseH as h } from 'lib/snabbdom';
import type SetupCtrl from './setupCtrl';
import { type BotInfo, Bot } from 'lib/bot/bot';
import { miniBoard } from '../ground';

export const setupView = (ctrl: SetupCtrl) =>
  h('main.bot-app.bot-setup', [viewOngoing(ctrl), viewBotList(ctrl)]);

const viewOngoing = (ctrl: SetupCtrl) => {
  const g = ctrl.ongoingGame();
  return g && !g.game.end
    ? h('div.bot-setup__ongoing', { hook: bind('click', ctrl.resume, ctrl.redraw) }, [
        h('div.bot-setup__ongoing__preview', miniBoard(g.board, g.game.pov)),
        g.bot.image &&
          h('img.bot-setup__ongoing__image', {
            attrs: { src: botAssetUrl('image', g.bot.image) },
          }),
        h('div.bot-setup__ongoing__content', [
          h('h2.bot-setup__ongoing__name', g.bot.name),
          h('p.bot-setup__ongoing__text', 'Should we resume our game?'),
        ]),
      ])
    : undefined;
};

const viewBotList = (ctrl: SetupCtrl) =>
  h(
    'div.bot-setup__bots',
    ctrl.opts.bots.map(bot => viewBotCard(ctrl, bot)),
  );

const viewBotCard = (ctrl: SetupCtrl, bot: BotInfo) =>
  h('div.bot-card', { hook: bind('click', () => ctrl.play(bot)) }, [
    h('img.bot-card__image', {
      attrs: { src: bot?.image && botAssetUrl('image', bot.image) },
    }),
    h('div.bot-card__content', [
      h('div.bot-card__header', [
        h('h2.bot-card__name', bot.name),
        h('span.bot-card__rating', Bot.rating(bot, 'classical').toString()),
      ]),
      h('p.bot-card__description', bot.description),
    ]),
  ]);
