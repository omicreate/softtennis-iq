import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { href } from './route'
import { isTrackingOff, setTrackingOff } from './trackSetting'
import './privacy.css'

/** プライバシーと計測：何を、何のために数えるか。送らない選択もここで */
export function Privacy() {
  const [off, setOff] = useState(isTrackingOff)
  const choose = (v: boolean) => {
    setTrackingOff(v)
    setOff(v)
  }
  return (
    <div className="screen">
      <header className="appbar">
        <a className="icon-btn" href={href()} aria-label="ホームへ戻る">
          <ChevronLeft size={24} />
        </a>
        <div className="appbar-title">
          <span className="brandmark" aria-hidden="true" />
          プライバシーと計測
        </div>
      </header>
      <main className="screen-body privacy">
        <section>
          <h1 className="section-title">このアプリが数えること</h1>
          <p>
            ソフトテニスIQは、どのSNSや投稿から来てもらえたか、どの機能が使われているかを知り、アプリを良くするために、次のことだけを数えています。
          </p>
          <ul>
            <li>Instagram などのリンクから開いたときの、リンクの印（例：Instagram のプロフィール）</li>
            <li>開いた機能の名前（例：局面クイズ・陣形ラボ）</li>
          </ul>
          <p>リンクから開いたときだけ、1回だけ送ります。ふつうに開いたときは送りません。</p>
        </section>
        <section>
          <h2 className="section-title">数えないこと</h2>
          <ul>
            <li>名前・学校・チーム・写真・メールアドレス</li>
            <li>試合ノートの記録・クイズの答え・陣形の配置（どれもあなたの端末の中だけに保存されます）</li>
            <li>端末を見分ける番号・Cookie・位置情報</li>
          </ul>
          <p>広告や、ほかの会社の解析ツールは使っていません。</p>
        </section>
        <section>
          <h2 className="section-title">保存と期間</h2>
          <p>
            数えた回数は、運営者（omicreate）だけが見られる表に保存します。ほかの人や会社には渡しません。1回ごとの記録は13か月で消し、そのあとは日ごとの合計の数だけを残します。
          </p>
        </section>
        <section aria-labelledby="track-choice">
          <h2 id="track-choice" className="section-title">
            数えてよいか
          </h2>
          <div className="privacy-choice" role="radiogroup" aria-label="計測に送るか">
            <button type="button" role="radio" aria-checked={!off} className="privacy-chip" onClick={() => choose(false)}>
              送る
            </button>
            <button type="button" role="radio" aria-checked={off} className="privacy-chip" onClick={() => choose(true)}>
              送らない
            </button>
          </div>
          <p className="hint" role="status">
            {off ? '「送らない」になっています。この端末からは送りません。' : '「送らない」を選ぶと、この端末からは送らなくなります。'}
            ブラウザの「追跡しない」設定がオンのときも送りません。
          </p>
        </section>
        <p className="hint">運営：omicreate（@softtennis_iq）</p>
      </main>
    </div>
  )
}
