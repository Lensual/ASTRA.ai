import { IOptions, IChatItem, Language, VoiceType } from "@/types"
import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { DEFAULT_OPTIONS, COLOR_LIST, setOptionsToLocal, genRandomChatList } from "@/common"

export interface InitialState {
  options: IOptions
  roomConnected: boolean,
  agentConnected: boolean,
  themeColor: string,
  language: Language
  voiceType: VoiceType
  chatItems: IChatItem[],
  graphName: string,
  graphs: string[],
  extensions: Record<string, any>,
  extensionMetadata: Record<string, any>
}

const getInitialState = (): InitialState => {
  return {
    options: DEFAULT_OPTIONS,
    themeColor: COLOR_LIST[0].active,
    roomConnected: false,
    agentConnected: false,
    language: "en-US",
    voiceType: "male",
    chatItems: [],
    graphName: "camera_va_openai_azure",
    graphs: [],
    extensions: {},
    extensionMetadata: {},
  }
}

export const globalSlice = createSlice({
  name: "global",
  initialState: getInitialState(),
  reducers: {
    setOptions: (state, action: PayloadAction<Partial<IOptions>>) => {
      state.options = { ...state.options, ...action.payload }
      setOptionsToLocal(state.options)
    },
    setThemeColor: (state, action: PayloadAction<string>) => {
      state.themeColor = action.payload
      document.documentElement.style.setProperty('--theme-color', action.payload);
    },
    setRoomConnected: (state, action: PayloadAction<boolean>) => {
      state.roomConnected = action.payload
    },
    addChatItem: (state, action: PayloadAction<IChatItem>) => {
      const { userId, text, isFinal, type, time } = action.payload
      const LastFinalIndex = state.chatItems.findLastIndex((el) => {
        return el.userId == userId && el.isFinal
      })
      const LastNonFinalIndex = state.chatItems.findLastIndex((el) => {
        return el.userId == userId && !el.isFinal
      })
      let LastFinalItem = state.chatItems[LastFinalIndex]
      let LastNonFinalItem = state.chatItems[LastNonFinalIndex]
      if (LastFinalItem) {
        // has last final Item
        if (time <= LastFinalItem.time) {
          // discard
          console.log("[test] addChatItem, time < last final item, discard!:", text, isFinal, type)
          return
        } else {
          if (LastNonFinalItem) {
            console.log("[test] addChatItem, update last item(none final):", text, isFinal, type)
            state.chatItems[LastNonFinalIndex] = action.payload
          } else {
            console.log("[test] addChatItem, add new item:", text, isFinal, type)
            state.chatItems.push(action.payload)
          }
        }
      } else {
        // no last final Item
        if (LastNonFinalItem) {
          console.log("[test] addChatItem, update last item(none final):", text, isFinal, type)
          state.chatItems[LastNonFinalIndex] = action.payload
        } else {
          console.log("[test] addChatItem, add new item:", text, isFinal, type)
          state.chatItems.push(action.payload)
        }
      }
      state.chatItems.sort((a, b) => a.time - b.time)
    },
    setAgentConnected: (state, action: PayloadAction<boolean>) => {
      state.agentConnected = action.payload
    },
    setLanguage: (state, action: PayloadAction<Language>) => {
      state.language = action.payload
    },
    setGraphName: (state, action: PayloadAction<string>) => {
      state.graphName = action.payload
    },
    setGraphs: (state, action: PayloadAction<string[]>) => {
      state.graphs = action.payload
    },
    setExtensions: (state, action: PayloadAction<Record<string, any>>) => {
      let { graphName, nodesMap } = action.payload
      state.extensions[graphName] = nodesMap
    },
    setExtensionMetadata: (state, action: PayloadAction<Record<string, any>>) => {
      state.extensionMetadata = action.payload
    },
    setVoiceType: (state, action: PayloadAction<VoiceType>) => {
      state.voiceType = action.payload
    },
    reset: (state) => {
      Object.assign(state, getInitialState())
      document.documentElement.style.setProperty('--theme-color', COLOR_LIST[0].active);
    },
  },
})

export const { reset, setOptions,
  setRoomConnected, setAgentConnected, setVoiceType,
  addChatItem, setThemeColor, setLanguage, setGraphName, setGraphs, setExtensions, setExtensionMetadata } =
  globalSlice.actions

export default globalSlice.reducer
