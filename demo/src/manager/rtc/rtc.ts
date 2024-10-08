"use client"

import protoRoot from "@/protobuf/SttMessage_es6.js"
import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
  UID,
} from "agora-rtc-sdk-ng"
import { ITextItem } from "@/types"
import { AGEventEmitter } from "../events"
import { RtcEvents, IUserTracks } from "./types"
import { apiGenAgoraData } from "@/common"

export class RtcManager extends AGEventEmitter<RtcEvents> {
  private _joined
  client: IAgoraRTCClient
  localTracks: IUserTracks

  constructor() {
    super()
    this._joined = false
    this.localTracks = {}
    this.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
    this._listenRtcEvents()
  }

  async join({ channel, userId }: { channel: string; userId: number }) {
    if (!this._joined) {
      const res = await apiGenAgoraData({ channel, userId })
      const { code, data } = res
      if (code != 0) {
        throw new Error("Failed to get Agora token")
      }
      const { appId, token } = data
      await this.client?.join(appId, channel, token, userId)
      this._joined = true
    }
  }

  async createTracks() {
    try {
      const videoTrack = await AgoraRTC.createCameraVideoTrack()
      this.localTracks.videoTrack = videoTrack
    } catch (err) {
      console.error("Failed to create video track", err)
    }
    try {
      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack()
      this.localTracks.audioTrack = audioTrack
    } catch (err) {
      console.error("Failed to create audio track", err)
    }
    this.emit("localTracksChanged", this.localTracks)
  }

  async publish() {
    const tracks = []
    if (this.localTracks.videoTrack) {
      tracks.push(this.localTracks.videoTrack)
    }
    if (this.localTracks.audioTrack) {
      tracks.push(this.localTracks.audioTrack)
    }
    if (tracks.length) {
      await this.client.publish(tracks)
    }
  }

  async destroy() {
    this.localTracks?.audioTrack?.close()
    this.localTracks?.videoTrack?.close()
    if (this._joined) {
      await this.client?.leave()
    }
    this._resetData()
  }

  // ----------- public methods ------------

  // -------------- private methods --------------
  private _listenRtcEvents() {
    this.client.on("network-quality", (quality) => {
      this.emit("networkQuality", quality)
    })
    this.client.on("user-published", async (user, mediaType) => {
      await this.client.subscribe(user, mediaType)
      if (mediaType === "audio") {
        this._playAudio(user.audioTrack)
      }
      this.emit("remoteUserChanged", {
        userId: user.uid,
        audioTrack: user.audioTrack,
        videoTrack: user.videoTrack,
      })
    })
    this.client.on("user-unpublished", async (user, mediaType) => {
      await this.client.unsubscribe(user, mediaType)
      this.emit("remoteUserChanged", {
        userId: user.uid,
        audioTrack: user.audioTrack,
        videoTrack: user.videoTrack,
      })
    })
    this.client.on("stream-message", (uid: UID, stream: any) => {
      this._parseData(stream)
    })
  }

  private _parseData(data: any): ITextItem | void {
    let decoder = new TextDecoder('utf-8');
    let decodedMessage = decoder.decode(data);
    const textstream = JSON.parse(decodedMessage);
  
    console.log("[test] textstream raw data", JSON.stringify(textstream));
    
    const { stream_id, is_final, text, text_ts, data_type, message_id, part_number, total_parts } = textstream;
  
    if (total_parts > 0) {
      // If message is split, handle it accordingly
      this._handleSplitMessage(message_id, part_number, total_parts, stream_id, is_final, text, text_ts);
    } else {
      // If there is no message_id, treat it as a complete message
      this._handleCompleteMessage(stream_id, is_final, text, text_ts);
    }
  }
  
  private messageCache: { [key: string]: { parts: string[], totalParts: number } } = {};
  
  /**
   * Handle complete messages (not split).
   */
  private _handleCompleteMessage(stream_id: number, is_final: boolean, text: string, text_ts: number): void {
    const textItem: ITextItem = {
      uid: `${stream_id}`,
      time: text_ts,
      dataType: "transcribe",
      text: text,
      isFinal: is_final
    };

    if (text.trim().length > 0) {
      this.emit("textChanged", textItem);
    }
  }
  
  /**
   * Handle split messages, track parts, and reassemble once all parts are received.
   */
  private _handleSplitMessage(
    message_id: string,
    part_number: number,
    total_parts: number,
    stream_id: number,
    is_final: boolean,
    text: string,
    text_ts: number
  ): void {
    // Ensure the messageCache entry exists for this message_id
    if (!this.messageCache[message_id]) {
      this.messageCache[message_id] = { parts: [], totalParts: total_parts };
    }
  
    const cache = this.messageCache[message_id];
  
    // Store the received part at the correct index (part_number starts from 1, so we use part_number - 1)
    cache.parts[part_number - 1] = text;
  
    // Check if all parts have been received
    const receivedPartsCount = cache.parts.filter(part => part !== undefined).length;
  
    if (receivedPartsCount === total_parts) {
      // All parts have been received, reassemble the message
      const fullText = cache.parts.join('');
  
      // Now that the message is reassembled, handle it like a complete message
      this._handleCompleteMessage(stream_id, is_final, fullText, text_ts);
  
      // Remove the cached message since it is now fully processed
      delete this.messageCache[message_id];
    }
  }


  _playAudio(audioTrack: IMicrophoneAudioTrack | IRemoteAudioTrack | undefined) {
    if (audioTrack && !audioTrack.isPlaying) {
      audioTrack.play()
    }
  }


  private _resetData() {
    this.localTracks = {}
    this._joined = false
  }
}


export const rtcManager = new RtcManager()
