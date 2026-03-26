import {
  CHAR_MAX,
  decodeNumber,
  deinterleave,
  EoReader,
  EoWriter,
  encodeNumber,
  flipMsb,
  interleave,
  type Packet,
  PacketAction,
  PacketFamily,
  PacketSequencer,
  SequenceStart,
  swapMultiples,
} from 'eolib';
export class PacketBus {
  private socket: WebSocket;
  private sequencer: PacketSequencer;
  private encodeMultiple = 0;
  private decodeMultiple = 0;
  private recvBuffer: Uint8Array = new Uint8Array(0);
  private handlers: Map<
    PacketFamily,
    Map<PacketAction, (reader: EoReader) => void>
  > = new Map();
  constructor(socket: WebSocket) {
    this.socket = socket;
    this.sequencer = new PacketSequencer(SequenceStart.zero());
    this.socket.addEventListener('message', (e) => {
      const promise = e.data.arrayBuffer();
      promise
        .then((buf: ArrayBuffer) => {
          this.appendToBuffer(new Uint8Array(buf));
          try {
            this.processBuffer();
          } catch (err) {
            console.error('Error processing packet', err);
          }
        })
        .catch((err: Error) => {
          console.error('Failed to get array buffer', err);
        });
    });
  }

  disconnect() {
    this.socket.close();
  }

  setSequence(sequence: SequenceStart) {
    this.sequencer.sequenceStart = sequence;
  }

  setEncryption(encodeMultiple: number, decodeMultiple: number) {
    this.encodeMultiple = encodeMultiple;
    this.decodeMultiple = decodeMultiple;
  }

  private appendToBuffer(data: Uint8Array) {
    const combined = new Uint8Array(this.recvBuffer.length + data.length);
    combined.set(this.recvBuffer);
    combined.set(data, this.recvBuffer.length);
    this.recvBuffer = combined;
  }

  private processBuffer() {
    while (this.recvBuffer.length >= 2) {
      const packetLength = decodeNumber(this.recvBuffer.slice(0, 2));

      if (this.recvBuffer.length < 2 + packetLength) {
        break;
      }

      const packetData = this.recvBuffer.slice(2, 2 + packetLength);
      this.recvBuffer = this.recvBuffer.slice(2 + packetLength);
      this.handlePacket(packetData);
    }
  }

  private handlePacket(data: Uint8Array) {
    if (data[0] !== 0xff && data[1] !== 0xff) {
      deinterleave(data);
      flipMsb(data);
      swapMultiples(data, this.decodeMultiple);
    }

    const action = data[0];
    const family = data[1];

    const packetBuf = data.slice(2);

    const reader = new EoReader(packetBuf);
    const familyHandlers = this.handlers.get(family);
    if (familyHandlers) {
      const handler = familyHandlers.get(action);
      if (handler) {
        handler(reader);
      } else {
        console.error(
          `Unhandled packet: ${PacketFamily[family]}_${PacketAction[action]}`,
        );
      }
    } else {
      console.error(
        `Unhandled packet: ${PacketFamily[family]}_${PacketAction[action]}`,
      );
    }
  }

  send(packet: Packet) {
    const writer = new EoWriter();
    packet.serialize(writer);
    this.sendBuf(packet.family, packet.action, writer.toByteArray());
  }

  sendBuf(family: PacketFamily, action: PacketAction, buf: Uint8Array) {
    const data = [...buf];
    const sequence = this.sequencer.nextSequence();

    if (action !== 0xff && family !== 0xff) {
      const sequenceBytes = encodeNumber(sequence);
      if (sequence > CHAR_MAX) {
        data.unshift(sequenceBytes[1]);
      }
      data.unshift(sequenceBytes[0]);
    }

    data.unshift(family);
    data.unshift(action);

    const temp = new Uint8Array(data);

    if (data[0] !== 0xff && data[1] !== 0xff) {
      swapMultiples(temp, this.encodeMultiple);
      flipMsb(temp);
      interleave(temp);
    }

    const lengthBytes = encodeNumber(temp.length);

    const payload = new Uint8Array([lengthBytes[0], lengthBytes[1], ...temp]);
    this.socket.send(payload);
  }

  registerPacketHandler(
    family: PacketFamily,
    action: PacketAction,
    callback: (reader: EoReader) => void,
  ) {
    if (!this.handlers.has(family)) {
      this.handlers.set(family, new Map());
    }

    const actionMap = this.handlers.get(family);
    actionMap!.set!(action, callback);
  }
}
