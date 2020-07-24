const isBrowser = typeof document === 'object'
    && Object.prototype.toString.call(document) === '[object HTMLDocument]';

let mozFirstPaintTime = null;

function mozPaintHandler() {
  window.removeEventListener('MozAfterPaint', mozPaintHandler);
  mozFirstPaintTime = new Date().getTime();
}

function supportTiming() {
  return window.performance
      && Object.prototype.toString.call(window.performance.timing)
      === '[object PerformanceTiming]';
}

function calcFirstPaint() {
  let result = -1;
  if (window.performance && window.performance.getEntriesByType) {
    const performanceEntries = window.performance.getEntriesByType('paint');
    performanceEntries.forEach((performanceEntry) => {
      if (performanceEntry.name === 'first-paint') {
        result = performanceEntry.startTime;
      }
    });
  } else if (typeof window.performance.timing.msFirstPaint !== 'undefined') {
    result = window.performance.timing.msFirstPaint
        - window.performance.timing.navigationStart;
  } else if (mozFirstPaintTime !== null) {
    result = mozFirstPaintTime - window.performance.timing.navigationStart;
  }
  if (!result) {
    if (window.Tracker.firstPaintTime) {
      result = window.Tracker.firstPaintTime
          - window.performance.timing.navigationStart;
    } else {
      console.log('请设置Tracker.firstPaintTime');
    }
  }
  return result;
}

function initPerformanceIfNeeded() {
  if (!window.Tracker) {
    console.error(`请在head开始处初始化Tracker对象
    example：
      window.Tracker={
        project: 'official-website',
        start: Date.now(), 
        percent: 20, //上报比例
      }
    `);
    return;
  }
  if (!window.performance) {
    window.performance = {
      timing: {
        navigationStart: window.Tracker.start,
      },
    };
  }
}

// 用户设置的时间
const timeByUser = {};

function setAboveTheFoldTime(time) {
  timeByUser.aboveTheFold = time - window.performance.timing.navigationStart;
}

function calcLoad() {
  return window.performance.timing.loadEventEnd
      - window.performance.timing.navigationStart;
}

function calcDOMContentLoaded() {
  return (window.Tracker.dom_content_loaded_time ||
      window.performance.timing.domContentLoadedEventEnd)
      - window.performance.timing.navigationStart;
}

function send() {
  if (window.Tracker && window.Tracker.project) {
    const indicatorList = {
      first_paint: calcFirstPaint(),
      above_the_fold: timeByUser.aboveTheFold,
      dom_content_loaded: calcDOMContentLoaded(),
      load_time: calcLoad(),
      api_call_time: window.Tracker.api_call_time || -1,
    };
    if (performance.getEntriesByType) {
      const performanceEntry = performance.getEntriesByType('navigation')[0];
      if (performanceEntry) {
        indicatorList.response_start = performanceEntry.responseStart;
      }
    }
    const params = {
      project: window.Tracker.project,
      url: encodeURIComponent(window.location.href),
      screen: `${window.screen.width}*${window.screen.height}|${window.screen.availWidth}*${window.screen.availHeight}`,
      list: [],
    };
    Object.keys(indicatorList).forEach((key) => {
      if (indicatorList[key]) {
        params.list.push(key, parseInt(indicatorList[key]));
      }
    });
    const paramsString = Object.keys(params).
        map(key => `${key}=${Array.isArray(params[key])
            ? params[key].join(',')
            : params[key]}`).
        join('&');
    new Image().src = `http://fe-perf.hzstat.cn/perf-log/store?${paramsString}`;
  }
}

if (isBrowser) {
  initPerformanceIfNeeded();
  document.addEventListener('DOMContentLoaded', () => {
    if (!supportTiming()) {
      window.performance.timing.domContentLoadedEventEnd = Date.now();
    }
  });

  window.addEventListener('MozAfterPaint', mozPaintHandler, true);

  window.addEventListener('load', () => {
    if (!supportTiming()) {
      window.performance.timing.loadEventEnd = Date.now();
    }
    if (window.Tracker.ssr !== false) {
      setTimeout(() => {
        send();
      });
    }
  });
  if (window.Tracker) {
    window.Tracker.send = send;
  }

}
