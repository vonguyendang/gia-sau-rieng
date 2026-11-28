/**
 * public/js/speech.js
 * Đọc bảng giá sầu riêng hôm nay bằng giọng nói tiếng Việt tự nhiên (Web Speech API).
 * Chạy 100% offline ngay trên trình duyệt (0đ, không cần gọi API Cloud TTS bên thứ ba).
 */

let isSpeaking = false;
let currentUtterance = null;

function toggleSpeechPlayback() {
  if (!('speechSynthesis' in window)) {
    alert('Trình duyệt của bạn chưa hỗ trợ tính năng đọc giọng nói Web Speech.');
    return;
  }

  const synth = window.speechSynthesis;
  const btn = document.getElementById('btn-speech-toggle');
  const icon = document.getElementById('speech-icon');
  const textSpan = document.getElementById('speech-text');

  if (isSpeaking) {
    synth.cancel();
    setSpeakingState(false);
    return;
  }

  const textToRead = generateSpeechScript();
  if (!textToRead) {
    alert('Dữ liệu giá chưa sẵn sàng để đọc.');
    return;
  }

  synth.cancel(); // Dừng các âm thanh cũ nếu có

  const utterance = new SpeechSynthesisUtterance(textToRead);
  currentUtterance = utterance;

  // Cấu hình ngôn ngữ tiếng Việt
  utterance.lang = 'vi-VN';
  utterance.rate = 0.95; // Tốc độ vừa phải, dễ nghe
  utterance.pitch = 1.0;

  // Tìm giọng tiếng Việt tối ưu có sẵn trên thiết bị
  const voices = synth.getVoices();
  const viVoice = voices.find(v => v.lang && (v.lang.includes('vi') || v.lang.includes('VN')));
  if (viVoice) {
    utterance.voice = viVoice;
  }

  utterance.onstart = () => {
    setSpeakingState(true);
  };

  utterance.onend = () => {
    setSpeakingState(false);
  };

  utterance.onerror = (e) => {
    console.warn('Lỗi đọc giọng nói:', e);
    setSpeakingState(false);
  };

  synth.speak(utterance);
}

function setSpeakingState(speaking) {
  isSpeaking = speaking;
  const btn = document.getElementById('btn-speech-toggle');
  const icon = document.getElementById('speech-icon');
  const textSpan = document.getElementById('speech-text');

  if (!btn) return;

  if (speaking) {
    btn.classList.add('bg-amber-400', 'text-emerald-950', 'ring-2', 'ring-amber-300');
    btn.classList.remove('bg-white', 'text-slate-700');
    if (icon) {
      icon.className = 'fa-solid fa-volume-high text-xs text-emerald-900 animate-pulse';
    }
    if (textSpan) textSpan.textContent = 'Đang phát... (Bấm để dừng)';
  } else {
    btn.classList.remove('bg-amber-400', 'text-emerald-950', 'ring-2', 'ring-amber-300');
    btn.classList.add('bg-white', 'text-slate-700');
    if (icon) {
      icon.className = 'fa-solid fa-volume-high text-xs text-emerald-600';
    }
    if (textSpan) textSpan.textContent = 'Nghe Báo Giá';
  }
}

function generateSpeechScript() {
  if (!historyData || !historyData.days) return '';

  const daysKeys = historyData.available_days || Object.keys(historyData.days).sort().reverse();
  const activeDay = currentSelectedDay || daysKeys[0];
  const dayData = historyData.days[activeDay];
  if (!dayData) return '';

  let prices = dayData.daily_average || {};
  let regName = 'toàn quốc';
  if (currentRegion !== 'all' && dayData.by_region && dayData.by_region[currentRegion]) {
    prices = dayData.by_region[currentRegion];
    const regNames = {
      mientay: 'khu vực miền Tây',
      miendong: 'khu vực miền Đông',
      taynguyen: 'khu vực Tây Nguyên'
    };
    regName = regNames[currentRegion] || currentRegion;
  }

  const parts = activeDay.split('-');
  const d = parseInt(parts[2], 10);
  const m = parseInt(parts[1], 10);
  const y = parts[0];

  let script = `Bản tin giá sầu riêng hôm nay ngày ${d} tháng ${m} năm ${y}, ${regName}. `;

  if (prices.ri6_a) {
    script += `Sầu riêng Ri Sáu loại A, giá ${formatSpeechNumber(prices.ri6_a)} đồng một ký. `;
  }
  if (prices.ri6_b) {
    script += `Ri Sáu loại B, giá ${formatSpeechNumber(prices.ri6_b)} đồng. `;
  }
  if (prices.monthong_a) {
    script += `Thái Mỏn Thong loại A, giá ${formatSpeechNumber(prices.monthong_a)} đồng một ký. `;
  }
  if (prices.monthong_b) {
    script += `Thái Mỏn Thong loại B, giá ${formatSpeechNumber(prices.monthong_b)} đồng. `;
  }
  if (prices.musang_king) {
    script += `Mu-sang King, giá ${formatSpeechNumber(prices.musang_king)} đồng một ký. `;
  }
  if (prices.black_thorn) {
    script += `Black Thorn gai đen, giá ${formatSpeechNumber(prices.black_thorn)} đồng. `;
  }
  if (prices.chuong_bo) {
    script += `Chuồng bò, giá ${formatSpeechNumber(prices.chuong_bo)} đồng. `;
  }

  script += `Giá áp dụng thương lái thu mua cắt xô tận vườn. Chúc quý nhà vườn và bà con một ngày giao dịch thành công.`;
  return script;
}

function formatSpeechNumber(num) {
  if (!num) return 'không';
  // Đọc số tự nhiên cho máy đọc: ví dụ 60000 -> 60 nghìn
  if (num >= 1000) {
    const thousands = Math.round(num / 1000);
    return `${thousands} nghìn`;
  }
  return num.toString();
}

// Tự động tải danh sách giọng nói khi trình duyệt sẵn sàng
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
