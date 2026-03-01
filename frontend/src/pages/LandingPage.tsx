import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthSession } from "../lib/api";
import FlagIcon from '@mui/icons-material/Flag';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ForumIcon from '@mui/icons-material/Forum';

export function LandingPage() {
  const navigate = useNavigate();
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isRendered, setIsRendered] = useState(false);

  const tutorialData = [
    { src: "/tutorial1.png", text: "ユーザー登録をしてください" },
    { src: "/tutorial2.png", text: "ホーム画面から目標作成ボタンをクリック" },
    { src: "/tutorial3.png", text: "長期目標と期限、現状を入力して「プランを立てる」をクリック" },
    { src: "/tutorial3_2.png", text: "メンターAIが目標をブレイクダウンして毎日のTODOを作成してくれます" },
    { src: "/tutorial4.png", text: "タスクが完了したらホーム画面で完了ボタンを押しましょう" },
    { src: "/tutorial5.png", text: "タスクをすべて完了するとメンターAIが喜んでくれます" },
    { src: "/tutorial6.png", text: "タイムラインで友達と進捗を共有しましょう" },
    { src: "/tutorial7.png", text: "STATS画面で今までの頑張りを振り返りましょう" }
  ];

  useEffect(() => {
    if (isTutorialOpen) {
      setIsRendered(true);
    } else {
      const timer = setTimeout(() => setIsRendered(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isTutorialOpen]);

  const handleStartFree = () => {
    const session = getAuthSession();
    if (session) {
      navigate("/");
    } else {
      navigate("/auth/register");
    }
  };

  const handleLogin = () => {
    navigate("/auth/login");
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === tutorialData.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? tutorialData.length - 1 : prev - 1));
  };

  const closeTutorial = () => {
    setIsTutorialOpen(false);
    setTimeout(() => setCurrentSlide(0), 500);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-white text-slate-800 font-sans antialiased selection:bg-[#13ec37] selection:text-black">
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-[#13ec37]">
              <img src="/sasa.png" alt="ロゴ画像" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Str<span className="text-[#13ec37]">eee</span>ak
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogin}
              className="hidden text-sm font-medium text-slate-900 hover:text-[#13ec37] md:block"
            >
              ログイン
            </button>
            <button
              onClick={handleStartFree}
              className="flex h-10 items-center justify-center rounded-full bg-[#13ec37]/10 text-[#13ec37] px-6 text-sm font-bold border-2 border-[#13ec37] transition-transform hover:bg-opacity-90 hover:scale-[1.02] active:scale-95 shadow-sm"
            >
              無料で始める
            </button>
          </div>
        </div>
      </header>

      <section className="relative flex flex-col items-center justify-center py-24 lg:py-32 overflow-hidden bg-white">
        <div className="absolute -top-20 -right-20 w-[600px] h-[600px] bg-gray-50 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="absolute top-40 -left-20 w-[400px] h-[400px] bg-green-50 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div className="container relative z-10 px-4 text-center">
          <h1 className="mx-auto max-w-5xl text-4xl font-black leading-[1.3] tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
            「漠然とした夢」を、<br />
            今日クリアすべき<span className="text-[#13ec37]">「クエスト」</span><br />に変えよう。
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg text-slate-500 md:text-xl leading-relaxed font-light">
            AIがメンターになり、あなたの目標を完全ナビゲート。<br className="hidden md:block" />
            ライバルと競い、夢を現実に変えるSNS。
            <br /><br />
            <span className="text-base">「何から始めればいいかわからない」「一人だと続かない」——そんな悩みはもう終わり。メンターAIと仲間の存在が、あなたの行動を加速させる。</span>
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={handleStartFree}
              className="group flex h-14 w-full sm:w-auto items-center justify-center rounded-full bg-[#13ec37]/10 text-[#13ec37] px-8 text-base font-bold transition-all hover:bg-[#13ec37]/20 hover:-translate-y-0.5 shadow-lg shadow-gray-200"
            >
              <span className="flex items-center gap-2">
                無料で目標をブレイクダウン
                <span className="material-symbols-outlined text-[#13ec37] group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </span>
            </button>
            <button
              onClick={() => setIsTutorialOpen(true)}
              className="flex h-14 w-full sm:w-auto items-center justify-center rounded-full bg-white px-8 text-base font-bold text-slate-700 border-2 border-slate-200 transition-all hover:bg-slate-50 hover:-translate-y-0.5 shadow-lg shadow-gray-200"
            >
              <span className="flex items-center gap-2">
                チュートリアルを見る
                <span className="material-symbols-outlined text-slate-500">play_circle</span>
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="py-24 bg-[#F3F4F6] border-y border-gray-200">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">こんな「もどかしさ」、感じていませんか？</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="group relative rounded-2xl bg-white p-8 shadow-sm hover:shadow-md transition-shadow duration-300 border border-transparent hover:border-gray-200">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#13ec37]/10 text-[#13ec37] text-2xl"><img src="/road.png" alt="分かれ道の画像" /></div>
              <p className="text-slate-600 text-sm leading-relaxed font-medium">大きな夢はあるけれど、今何をすべきか全くわからない。</p>
            </div>
            <div className="group relative rounded-2xl bg-white p-8 shadow-sm hover:shadow-md transition-shadow duration-300 border border-transparent hover:border-gray-200">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#13ec37]/10 text-[#13ec37] text-2xl"><img src="/smartphone.png" alt="スマホを触る人の画像" /></div>
              <p className="text-slate-600 text-sm leading-relaxed font-medium">スマホやゲームの誘惑に負けて、つい後回しにしてしまう。</p>
            </div>
            <div className="group relative rounded-2xl bg-white p-8 shadow-sm hover:shadow-md transition-shadow duration-300 border border-transparent hover:border-gray-200">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#13ec37]/10 text-[#13ec37] text-2xl"><img src="/down.png" alt="落ち込んでいる人の画像" className="opacity-75" /></div>
              <p className="text-slate-600 text-sm leading-relaxed font-medium">一人で頑張ろうと決意しても、いつも三日坊主で終わる。</p>
            </div>
            <div className="group relative rounded-2xl bg-white p-8 shadow-sm hover:shadow-md transition-shadow duration-300 border border-transparent hover:border-gray-200">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#13ec37]/10 text-[#13ec37] text-2xl"><img src="/ase.png" alt="焦っている人の画像" className="opacity-75" /></div>
              <p className="text-slate-600 text-sm leading-relaxed font-medium">周りの同世代がどんどん先に行っている気がして焦る。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-white" id="how-it-works">
        <div className="container relative z-10 mx-auto px-4 max-w-7xl">
          <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-6">
            <div>
              <span className="text-[#13ec37] font-bold text-sm tracking-wider uppercase mb-2 block">The Solution</span>
              <h2 className="text-3xl font-bold text-slate-900 md:text-4xl tracking-tight">
                夢を叶えるための最短ルートがここにある。
              </h2>
            </div>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 hover:border-[#13ec37]/30 transition-colors duration-300">
              <div className="flex justify-between items-start mb-8">
                <div className="bg-white h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm text-[#13ec37]">
                  <span className="material-symbols-outlined text-3xl">psychology</span>
                </div>
                <span className="text-sm font-mono text-slate-400 bg-white px-2 py-1 rounded">Point 1</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">AIが「今日やること」まで完全逆算</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                「長期目標」と「期限」を入力するだけ。AIが1ヶ月、1週間、そして「今日のTODO」まで具体的なステップを自動生成。あなたはAIのナビゲートに従ってクリアしていくだけです。
              </p>
            </div>
            <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 hover:border-[#13ec37]/30 transition-colors duration-300">
              <div className="flex justify-between items-start mb-8">
                <div className="bg-white h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm text-[#13ec37]">
                  <span className="material-symbols-outlined text-3xl">swords</span>
                </div>
                <span className="text-sm font-mono text-slate-400 bg-white px-2 py-1 rounded">Point 2</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">仲間と競い、サボれない環境を作る</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                進捗は毎日シェアされ、グループ内でランキング化。「あいつ、今日も進めてる…！」というポジティブな焦りが、あなたの重い腰を上げさせます。
              </p>
            </div>
            <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 hover:border-[#13ec37]/30 transition-colors duration-300">
              <div className="flex justify-between items-start mb-8">
                <div className="bg-white h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm text-[#13ec37]">
                  <span className="material-symbols-outlined text-3xl">monitoring</span>
                </div>
                <span className="text-sm font-mono text-slate-400 bg-white px-2 py-1 rounded">Point 3</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">成長をハックする、リザルト分析</h3>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                毎週の達成率や「何にどれくらい時間を使ったか」を視覚的にグラフ化。過去の自分の頑張りが、明日のモチベーションに繋がります。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-white border-t border-gray-200" id="features">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">夢を加速させるコア機能</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-6 rounded-2xl bg-white border border-gray-100 flex flex-col items-center text-center hover:border-[#13ec37]/50 hover:shadow-lg hover:shadow-gray-100 transition-all duration-300">
              <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center text-[#13ec37] mb-4 text-2xl"><FlagIcon /></div>
              <h4 className="font-bold text-slate-900 mb-2">目標ブレイクダウン</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Gemini APIを活用。対話形式であなたにぴったりの短期目標を生成・調整。</p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-gray-100 flex flex-col items-center text-center hover:border-[#13ec37]/50 hover:shadow-lg hover:shadow-gray-100 transition-all duration-300">
              <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center text-[#13ec37] mb-4 text-2xl"><TaskAltIcon /></div>
              <h4 className="font-bold text-slate-900 mb-2">デイリーTODO＆持ち越し</h4>
              <p className="text-xs text-slate-500 leading-relaxed">今日やるべきことがひと目でわかる。未達成のタスクは翌日へ自動的に引き継ぎ。</p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-gray-100 flex flex-col items-center text-center hover:border-[#13ec37]/50 hover:shadow-lg hover:shadow-gray-100 transition-all duration-300">
              <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center text-[#13ec37] mb-4 text-2xl"><EmojiEventsIcon /></div>
              <h4 className="font-bold text-slate-900 mb-2">チームランキング＆シェア</h4>
              <p className="text-xs text-slate-500 leading-relaxed">1週間の達成率でトップ3を表示。週末にはリセットされ、新たなバトルがスタート。</p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-gray-100 flex flex-col items-center text-center hover:border-[#13ec37]/50 hover:shadow-lg hover:shadow-gray-100 transition-all duration-300">
              <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center text-[#13ec37] mb-4 text-2xl"><ForumIcon /></div>
              <h4 className="font-bold text-slate-900 mb-2">自動投稿＆AIエール</h4>
              <p className="text-xs text-slate-500 leading-relaxed">指定時間に自動で進捗をシェア。アプリからの励まし通知でモチベーション低下を防止。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-32 overflow-hidden flex items-center justify-center bg-[#F3F4F6]">
        <div className="container relative z-10 px-4 text-center">
          <h2 className="mb-6 text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            ライバルは、もう始めているかもしれない。
          </h2>
          <p className="mb-10 text-lg text-slate-500 max-w-xl mx-auto font-light">
            一人で悩む時間は終わり。今日から、確実な一歩を踏み出そう。
          </p>
          <button
            onClick={handleStartFree}
            className="inline-flex h-16 items-center justify-center rounded-full bg-black px-12 text-lg font-bold text-white transition-all hover:scale-105 hover:bg-slate-800 shadow-xl shadow-gray-300"
          >
            <span className="flex items-center gap-3">
              今すぐアプリを始める (無料)
              <span className="material-symbols-outlined text-[#13ec37]">rocket_launch</span>
            </span>
          </button>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white py-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-[#13ec37]">
                <img src="/sasa.png" alt="ロゴ画像" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">Streeeak</span>
            </div>
            <div className="text-xs text-slate-400">
              © 2026 Streeeak. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      {isRendered && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 transition-opacity duration-500 ease-in-out ${
            isTutorialOpen ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className={`relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden transition-all duration-500 ease-out transform ${
              isTutorialOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-8"
            }`}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-bold text-slate-800">
                チュートリアル ({currentSlide + 1} / {tutorialData.length})
              </h3>
              <button
                onClick={closeTutorial}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="relative flex-1 bg-gray-100 flex items-center justify-center min-h-[300px] sm:min-h-[500px] overflow-hidden">
              {tutorialData.map((data, index) => (
                <img
                  key={index}
                  src={data.src}
                  alt={`Tutorial Slide ${index + 1}`}
                  className={`absolute max-h-full max-w-full object-contain transition-all duration-700 ease-in-out ${
                    index === currentSlide
                      ? "opacity-100 scale-100 z-10"
                      : "opacity-0 scale-95 z-0 pointer-events-none"
                  }`}
                />
              ))}

              <button
                onClick={prevSlide}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/80 shadow-md text-slate-800 hover:bg-white hover:scale-105 transition-all"
              >
                <span className="material-symbols-outlined">arrow_back_ios_new</span>
              </button>

              <button
                onClick={nextSlide}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/80 shadow-md text-slate-800 hover:bg-white hover:scale-105 transition-all"
              >
                <span className="material-symbols-outlined">arrow_forward_ios</span>
              </button>
            </div>

            <div className="relative w-full bg-white border-t border-gray-100 px-6 py-4 flex justify-center items-center min-h-[72px] overflow-hidden">
              {tutorialData.map((data, index) => (
                <p
                  key={index}
                  className={`absolute text-center text-slate-700 font-medium text-sm sm:text-base w-full px-6 transition-all duration-700 ease-in-out ${
                    index === currentSlide
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-2 pointer-events-none"
                  }`}
                >
                  {data.text}
                </p>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 p-4 bg-white border-t border-gray-50">
              {tutorialData.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2.5 rounded-full transition-all duration-500 ease-out ${
                    index === currentSlide ? "w-8 bg-[#13ec37]" : "w-2.5 bg-gray-300 hover:bg-gray-400"
                  }`}
                  aria-label={`Slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}