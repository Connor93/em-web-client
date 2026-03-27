import { TalkTellClientPacket } from 'eolib';
import type { Client } from '../../client';
import { ChatTab } from '../../client';
import { playSfxById, SfxId } from '../../sfx';
import { capitalize } from '../../utils';
import { ChatIcon } from '../chat/chat';
import { PmChatBubble } from './pm-chat-bubble';

import './pm-chat-bubble.css';

export class PmChatManager {
  private client: Client;
  private container: HTMLDivElement;
  private bubbles = new Map<string, PmChatBubble>();

  constructor(client: Client) {
    this.client = client;
    this.container = document.getElementById('pm-bubbles') as HTMLDivElement;
  }

  /** Called when an incoming PM is received (TalkTell handler) */
  receiveMessage(senderName: string, message: string) {
    const key = senderName.toLowerCase();
    let bubble = this.bubbles.get(key);

    if (!bubble) {
      bubble = this.createBubble(key);
    }

    bubble.addReceivedMessage(message);
  }

  /** Called when an outgoing PM is sent (chat-manager ! handler) */
  sentMessage(targetName: string, message: string) {
    const key = targetName.toLowerCase();
    let bubble = this.bubbles.get(key);

    if (!bubble) {
      bubble = this.createBubble(key);
    }

    bubble.addSentMessage(message);
  }

  private createBubble(playerName: string): PmChatBubble {
    const bubble = new PmChatBubble(playerName, this.client.name);

    bubble.on('send', ({ target, message }) => {
      // Send the PM packet
      const packet = new TalkTellClientPacket();
      packet.name = target.toLowerCase();
      packet.message = message;
      this.client.bus.send(packet);

      // Also add to the main chat window
      this.client.emit('chat', {
        icon: ChatIcon.Note,
        tab: ChatTab.Local,
        name: `${capitalize(this.client.name)}->${capitalize(target)}`,
        message,
      });

      playSfxById(SfxId.PrivateMessageSent);
    });

    bubble.on('close', ({ name }) => {
      this.removeBubble(name);
    });

    this.bubbles.set(playerName, bubble);
    this.container.appendChild(bubble.el);
    return bubble;
  }

  private removeBubble(name: string) {
    const bubble = this.bubbles.get(name);
    if (bubble) {
      bubble.destroy();
      this.bubbles.delete(name);
    }
  }
}
