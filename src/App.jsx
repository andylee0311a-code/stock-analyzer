import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, AlertTriangle, BarChart2, PieChart, ShieldAlert, FileText, ChevronRight, Loader2, Landmark, Moon, Sun, Plus, Minus, Type, ArrowUp } from 'lucide-react';

// 環境提供的 API Key (由系統自動注入)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  
  // 新增：控制「回到頁首」按鈕是否顯示的狀態
  const [showTopBtn, setShowTopBtn] = useState(false);

  // 新增：監聽捲動事件
  useEffect(() => {
    const handleScroll = () => {
      // 當網頁往下捲動超過 300px 時，顯示按鈕
      if (window.scrollY > 300) {
        setShowTopBtn(true);
      } else {
        setShowTopBtn(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    // 清除監聽器，避免 memory leak
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 新增：平滑捲動到頁首的函式
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  
  // 新增：深色模式與字體大小狀態管理
  const [darkMode, setDarkMode] = useState(false);
  const [textSizeIndex, setTextSizeIndex] = useState(1); // 0: sm, 1: base(預設), 2: lg, 3: xl, 4: 2xl
  const textSizes = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];

  // 定義與 Gem 相同的系統提示詞 (更新：限制為台股)
  const systemPrompt = `
你是一位頂尖的量化金融分析師、證券投資顧問及總體經濟專家。你的任務是針對使用者輸入的「台灣股市單一個股」或「台灣市場發行的 ETF」代碼/名稱，提供一份極度專業、客觀且具備深度的投資分析報告。請注意，本分析不包含美股或海外市場標的。

在回答之前，你必須使用搜尋工具檢索該標的「最新的股價」、「最新的三大法人（外資、投信、自營商）買賣超動向」、「最新的配息公告（殖利率）」以及「近期相關新聞」，以確保報告的時效性與正確性。

請嚴格遵守以下 7 個段落的主軸進行輸出，使用 Markdown 格式：
1. 大盤環境
2. 股票/ETF基本資訊
3. 配息分析
4. 最新三大法人動向（近期趨勢）
5. 成分股與產業分析 (若為ETF列出成分股及產業；若為單一個股分析產業地位與競爭對手)
6. 風險評估
7. 綜合分析與投資建議 (含推薦因素, 風險提醒, 投資評等, 評等理由)

語氣：專業、冷靜、客觀，數據導向。
  `;

  // 延遲重試機制 (Exponential Backoff)
  const fetchWithRetry = async (url, options, retries = 5) => {
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, delays[i]));
      }
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setReport('');

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: `請為我分析這檔標的：${query}` }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ google_search: {} }] // 啟用 Google 搜尋 Grounding 以獲取最新法人與股價資訊
      };

      const result = await fetchWithRetry(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        setReport(text);
      } else {
        setError('無法生成報告，請稍後再試。');
      }
    } catch (err) {
      console.error(err);
      setError('分析過程中發生錯誤，請檢查網路連線或稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  // 簡單的 Markdown 渲染器 (將特定標籤轉為有質感的 Tailwind UI)
  const renderMarkdown = (text) => {
    const lines = text.split('\n');
    let inList = false;
    
    // 依據字級狀態，同步調整標題比例
    const h2Size = ['text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl'][textSizeIndex];
    const h3Size = ['text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl'][textSizeIndex];

    return lines.map((line, index) => {
      // 處理大標題 (1. 2. 3. 等主軸)
      if (line.match(/^\d+\.\s/) || line.startsWith('## ')) {
        const titleText = line.replace(/^\d+\.\s/, '').replace(/^##\s/, '').replace(/\*\*/g, '');
        let Icon = ChevronRight;
        if (titleText.includes('大盤')) Icon = TrendingUp;
        if (titleText.includes('基本資訊')) Icon = FileText;
        if (titleText.includes('配息')) Icon = Landmark;
        if (titleText.includes('法人')) Icon = BarChart2;
        if (titleText.includes('成分股') || titleText.includes('產業')) Icon = PieChart;
        if (titleText.includes('風險')) Icon = ShieldAlert;
        if (titleText.includes('綜合分析') || titleText.includes('建議')) Icon = AlertTriangle;

        return (
          <div key={index} className="mt-8 mb-4">
            <h2 className={`${h2Size} font-bold flex items-center border-b-2 pb-2 transition-colors ${darkMode ? 'text-slate-100 border-slate-700' : 'text-slate-800 border-indigo-100'}`}>
              <div className="bg-indigo-600 p-1.5 rounded-lg mr-3">
                <Icon className="w-5 h-5 text-white" />
              </div>
              {titleText}
            </h2>
          </div>
        );
      }
      
      // 處理中標題
      if (line.startsWith('### ')) {
        return <h3 key={index} className={`${h3Size} font-bold mt-5 mb-2 transition-colors ${darkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>{line.replace(/^###\s/, '').replace(/\*\*/g, '')}</h3>;
      }

      // 處理條列清單
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const content = line.substring(2);
        // 處理粗體
        const formattedContent = content.split(/\*\*(.*?)\*\*/g).map((part, i) => 
          i % 2 === 1 ? <strong key={i} className={`font-semibold transition-colors ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{part}</strong> : part
        );
        return (
          <li key={index} className={`ml-6 mb-2 leading-relaxed list-disc transition-colors ${darkMode ? 'text-slate-300 marker:text-indigo-500' : 'text-slate-700 marker:text-indigo-400'}`}>
            {formattedContent}
          </li>
        );
      }

      // 處理一般文字與粗體
      if (line.trim() === '') return <div key={index} className="h-2"></div>;

      const formattedLine = line.split(/\*\*(.*?)\*\*/g).map((part, i) => 
        i % 2 === 1 ? <strong key={i} className={`font-semibold px-1 rounded transition-colors ${darkMode ? 'text-indigo-200 bg-indigo-900/50' : 'text-slate-900 bg-indigo-50'}`}>{part}</strong> : part
      );

      return <p key={index} className={`my-2 leading-relaxed transition-colors ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{formattedLine}</p>;
    });
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'bg-slate-900 selection:bg-indigo-900' : 'bg-slate-50 selection:bg-indigo-200'}`}>
      {/* 頂部導覽列 */}
      <header className={`shadow-sm border-b sticky top-0 z-10 transition-colors duration-300 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h1 className={`text-xl font-bold tracking-tight transition-colors ${darkMode ? 'text-white' : 'text-slate-800'}`}>AI 智能投資分析寶</h1>
          </div>

          {/* 新增：外觀與字體控制區 */}
          <div className="flex items-center space-x-2 md:space-x-4">
            <div className={`flex items-center rounded-lg border p-1 transition-colors ${darkMode ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-slate-100'}`}>
              <button onClick={() => setTextSizeIndex(Math.max(0, textSizeIndex - 1))} className={`p-1.5 rounded-md transition-colors ${darkMode ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-white text-slate-600'}`} title="縮小字體">
                 <Minus className="w-4 h-4" />
              </button>
              <Type className={`w-4 h-4 mx-1 transition-colors ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              <button onClick={() => setTextSizeIndex(Math.min(textSizes.length - 1, textSizeIndex + 1))} className={`p-1.5 rounded-md transition-colors ${darkMode ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-white text-slate-600'}`} title="放大字體">
                 <Plus className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-lg border transition-colors ${darkMode ? 'border-slate-600 bg-slate-700 text-yellow-400 hover:bg-slate-600' : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-white'}`} title="切換深色/淺色主題">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* 搜尋區塊 */}
        <div className={`rounded-2xl shadow-sm border p-6 md:p-8 mb-8 transition-colors duration-300 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h2 className={`text-2xl font-bold mb-2 transition-colors ${darkMode ? 'text-white' : 'text-slate-800'}`}>輸入標的，獲取法人級深度報告</h2>
          {/* 更新 UI 提示文字，移除美股 */}
          <p className={`mb-6 transition-colors ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>專注於台股市場單一個股或 ETF (例如: 2330, 0050, 00878, 聯發科)</p>
          
          <form onSubmit={handleAnalyze} className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className={`h-5 w-5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`block w-full pl-11 pr-4 py-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-lg ${darkMode ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white'}`}
                placeholder="輸入股票代碼或名稱 (如: 00878, 台積電)..."
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-8 rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                  分析中...
                </>
              ) : (
                '開始分析'
              )}
            </button>
          </form>
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div className={`border-l-4 p-4 rounded-r-xl mb-8 flex items-start ${darkMode ? 'bg-red-900/30 border-red-500 text-red-400' : 'bg-red-50 border-red-500 text-red-700'}`}>
            <AlertTriangle className={`h-5 w-5 mr-3 mt-0.5 ${darkMode ? 'text-red-400' : 'text-red-500'}`} />
            <p>{error}</p>
          </div>
        )}

        {/* 報告顯示區塊 */}
        {report && (
          <div className={`rounded-2xl shadow-sm border p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between mb-8 pb-6 border-b ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <div>
                <h2 className={`text-3xl font-extrabold tracking-tight transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}>投資分析評估報告</h2>
                <p className={`mt-2 flex items-center transition-colors ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                  資料已透過 Google 搜尋取得最新數據
                </p>
              </div>
              <div className={`hidden md:block px-4 py-2 rounded-full font-medium text-sm transition-colors ${darkMode ? 'bg-indigo-900 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                標的: {query}
              </div>
            </div>
            
            <div className={`report-content transition-all duration-300 ${textSizes[textSizeIndex]}`}>
              {renderMarkdown(report)}
            </div>

            {/* 新增：免責聲明警語 */}
            <div className={`mt-10 pt-6 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <p className={`font-bold text-center flex items-center justify-center text-lg ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                <AlertTriangle className="w-5 h-5 mr-2 shrink-0" />
                注意：本建議由 AI 生成，僅供參考，不構成實際投資勸誘，投資人應自負盈虧。
              </p>
            </div>
          </div>
        )}

        {/* 初始空狀態提示 */}
        {!report && !loading && !error && (
          <div className="text-center py-16 px-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors ${darkMode ? 'bg-indigo-900/50' : 'bg-indigo-50'}`}>
              <BarChart2 className={`w-10 h-10 ${darkMode ? 'text-indigo-400' : 'text-indigo-500'}`} />
            </div>
            <h3 className={`text-xl font-bold mb-2 transition-colors ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>等待輸入分析標的</h3>
            <p className={`max-w-md mx-auto transition-colors ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              此工具將從大盤環境、基本面、籌碼面(三大法人)到風險評估，為您產出完整的七大維度專業報告。
            </p>
          </div>
        )}
      </main>

      {/* 新增：設計師專屬頁尾簽名 (升級醒目漸層版) */}
      <footer className="py-8 text-center">
        <p className="inline-block text-lg font-extrabold tracking-widest uppercase bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent drop-shadow-sm hover:scale-105 transition-transform duration-300 cursor-default">
          Designed by Andy Lee
        </p>
      </footer>

      {/* 回到頁首浮動按鈕 */}
      {showTopBtn && (
        <button
          onClick={scrollToTop}
          className={`fixed bottom-8 right-8 p-3 rounded-full shadow-xl z-50 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 ${
            darkMode 
              ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/50' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
          }`}
          aria-label="回到頁首"
          title="回到頁首"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}