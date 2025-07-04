import {
  type KaldiRecognizer,
  type VoskClient,
  type ServerMessageResult,
  type ServerMessagePartialResult,
  createVoskClient,
} from '@lichess-org/vosk-browser';
import type { RecognizerOpts, VoskModule } from './interfaces';
import { type Selectable, Switch } from './switch';

const LOG_LEVEL = -1; // -1 errors only. 0 includes warnings, 3 is just insane

export function initModule(): VoskModule {
  const recs = new Switch<string, KaldiRec>();
  let voskClient: VoskClient;
  let lang: string;

  return {
    initModel,
    initRecognizer,
    isLoaded,
    select,
  };

  async function initModel(url: string, language: string): Promise<void> {
    voskClient?.terminate();
    recs.remove();
    voskClient = await createVoskClient({
      modelUrl: url,
      workerUrl: site.asset.url('npm/vosk/vosk.worker.js', { documentOrigin: true }),
      wasmUrl: site.asset.url('npm/vosk/vosk.wasm'),
      logLevel: LOG_LEVEL,
    });
    lang = language;
  }

  function initRecognizer(opts: RecognizerOpts): AudioNode | undefined {
    if (!opts.words?.length || !voskClient) {
      recs.remove(opts.recId);
      return;
    }
    const kaldi = new voskClient.KaldiRecognizer(opts.audioCtx.sampleRate, JSON.stringify(opts.words));

    // buffer size under 100ms for timely partial results, 200ms for full results
    const bufSize = 2 ** Math.ceil(Math.log2(opts.audioCtx.sampleRate / (opts.partial ? 16 : 8)));

    // fun fact - createScriptProcessor was deprecated in 2014
    const node = opts.audioCtx.createScriptProcessor(bufSize, 1, 1);
    if (opts.partial)
      kaldi.on('partialresult', (msg: ServerMessagePartialResult) => {
        if (msg.result.partial.length > 0) opts.broadcast(msg.result.partial, 'partial', 0);
      });
    else
      kaldi.on('result', (msg: ServerMessageResult) => {
        if (msg.result.text.length > 0) opts.broadcast(msg.result.text, 'full', 3000);
      });

    if (LOG_LEVEL >= -1)
      console.info(
        `Created ${opts.audioCtx.sampleRate.toFixed()}Hz recognizer '${
          opts.recId
        }' with buffer size ${bufSize}`,
        opts.words,
      );

    recs.add(opts.recId, new KaldiRec(kaldi, node, opts.partial));
    return node;
  }

  function isLoaded(language?: string): boolean {
    return voskClient !== undefined && (!language || language === lang);
  }

  function select(recId: string | false): void {
    recs.set(recId);
  }
}

class KaldiRec implements Selectable {
  kaldi: KaldiRecognizer;
  node: ScriptProcessorNode;
  partial: boolean;

  constructor(kaldi: KaldiRecognizer, node: ScriptProcessorNode, partial: boolean) {
    this.kaldi = kaldi;
    this.node = node;
    this.partial = partial;
  }
  select() {
    if (this.node.onaudioprocess) return;
    this.node.onaudioprocess = e => this.kaldi.acceptWaveform(e.inputBuffer);
  }
  deselect() {
    if (!this.node.onaudioprocess) return;
    this.kaldi.retrieveFinalResult(); // flush lattice
    this.node.onaudioprocess = null;
  }
  close() {
    this.deselect();
    this.kaldi.remove();
  }
}
