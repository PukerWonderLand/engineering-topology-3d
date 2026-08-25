"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "../i18n/types";

type LocalizedCopy = Record<Locale, string>;

interface WelcomeTourStep {
  id: string;
  eyebrow: LocalizedCopy;
  title: LocalizedCopy;
  description: LocalizedCopy;
  hint: LocalizedCopy;
  gif: string;
  poster: string;
}

export const WELCOME_TOUR_STORAGE_KEY = "engineering-topology-3d:onboarding:v1";

export const welcomeTourSteps: WelcomeTourStep[] = [
  {
    id: "project-overview",
    eyebrow: { "zh-CN": "01 · 项目介绍", "en-US": "01 · PROJECT OVERVIEW" },
    title: { "zh-CN": "让复杂关系可以被看见", "en-US": "Make complex relationships visible" },
    description: {
      "zh-CN": "我们致力于用可交互的 3D 拓扑，展示任何概念、系统和设计架构之间的组成关系、数据流向与构建原理。",
      "en-US": "We use interactive 3D topology to reveal how concepts, systems, and designs are composed, connected, and built.",
    },
    hint: { "zh-CN": "拖动旋转 · 滚轮缩放 · 从全景理解系统", "en-US": "Drag to orbit · Scroll to zoom · Start from the whole system" },
    gif: "01-project-overview.gif",
    poster: "01-project-overview.png",
  },
  {
    id: "progressive-labels",
    eyebrow: { "zh-CN": "02 · 渐进标签", "en-US": "02 · PROGRESSIVE LABELS" },
    title: { "zh-CN": "由远及近，逐级揭示细节", "en-US": "Reveal detail as you move closer" },
    description: {
      "zh-CN": "使用滚轮放大场景。镜头接近系统后，会依次显示区域、模块和子标签，让全景保持清晰、近景保留细节。",
      "en-US": "Zoom toward the scene to progressively reveal zones, modules, and detailed labels without cluttering the overview.",
    },
    hint: { "zh-CN": "滚轮向上放大，向下返回全景", "en-US": "Scroll up to zoom in and down to return to the overview" },
    gif: "02-progressive-labels.gif?v=2",
    poster: "02-progressive-labels.png?v=2",
  },
  {
    id: "index-navigation",
    eyebrow: { "zh-CN": "03 · 快速定位", "en-US": "03 · QUICK NAVIGATION" },
    title: { "zh-CN": "用系统索引快速定位", "en-US": "Jump to a node from the system index" },
    description: {
      "zh-CN": "点击左侧系统树或流程节点，镜头会平滑移动到对应的 3D 位置，同时高亮节点并打开它的详情。",
      "en-US": "Select a system or flow node on the left to fly the camera to its 3D position, highlight it, and open its details.",
    },
    hint: { "zh-CN": "单击定位 · 双击 3D 节点进入内部", "en-US": "Click to locate · Double-click the 3D node to enter" },
    gif: "03-index-navigation.gif",
    poster: "03-index-navigation.png",
  },
  {
    id: "display-settings",
    eyebrow: { "zh-CN": "04 · 显示设置", "en-US": "04 · DISPLAY SETTINGS" },
    title: { "zh-CN": "按习惯调整显示", "en-US": "Tune the view for your reading style" },
    description: {
      "zh-CN": "打开 3D 视口右下角的“显示设置”，即可调整标签大小、标签远近、连接线与主管道粗细等视觉参数。",
      "en-US": "Open Display Settings in the lower-right corner to tune label size, label distance, leader lines, and pipe thickness.",
    },
    hint: { "zh-CN": "所有设置保存在当前浏览器中，可一键恢复默认", "en-US": "Settings are saved in this browser and can be reset anytime" },
    gif: "04-display-settings.gif",
    poster: "04-display-settings.png",
  },
  {
    id: "node-deep-dive",
    eyebrow: { "zh-CN": "05 · 节点内部", "en-US": "05 · NODE DEEP DIVE" },
    title: { "zh-CN": "双击进入节点内部", "en-US": "Double-click to look inside a node" },
    description: {
      "zh-CN": "拉近到系统节点后双击节点，即可进入内部视图，查看函数入口、事务旅程、因果关系、构建原理和证据边界。",
      "en-US": "Move closer and double-click a node to inspect its functions, journeys, causal links, construction principles, and evidence boundaries.",
    },
    hint: { "zh-CN": "按 Esc 或“返回全景”退出节点内部", "en-US": "Press Esc or Return to overview to leave the node" },
    gif: "05-node-deep-dive.gif",
    poster: "05-node-deep-dive.png",
  },
];

function assetUrl(filename: string) {
  return `${import.meta.env.BASE_URL}onboarding/${filename}`;
}

export function WelcomeTour({ locale, open, onDismiss }: {
  locale: Locale;
  open: boolean;
  onDismiss: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const step = welcomeTourSteps[stepIndex];

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const nextStep = welcomeTourSteps[stepIndex + 1];
    if (!nextStep) return;
    const gif = new Image();
    const poster = new Image();
    gif.src = assetUrl(nextStep.gif);
    poster.src = assetUrl(nextStep.poster);
  }, [open, stepIndex]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setStepIndex((current) => Math.min(welcomeTourSteps.length - 1, current + 1));
      if (event.key === "ArrowLeft") setStepIndex((current) => Math.max(0, current - 1));
      if (event.key === "Escape") onDismiss();
      if (event.key === "Tab") {
        const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? []);
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss, open]);

  if (!open) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === welcomeTourSteps.length - 1;
  const copy = locale === "en-US"
    ? {
        product: "ENGINEERING TOPOLOGY 3D",
        skip: "Skip tour",
        previous: "Previous",
        next: "Next",
        start: "Start exploring",
        step: "Step",
        media: "Animated feature demonstration",
        close: "Close welcome tour",
      }
    : {
        product: "ENGINEERING TOPOLOGY 3D",
        skip: "跳过引导",
        previous: "上一步",
        next: "下一步",
        start: "开始探索",
        step: "步骤",
        media: "功能操作动图",
        close: "关闭欢迎引导",
      };

  return (
    <div className="welcome-tour-backdrop">
      <section ref={dialogRef} className="welcome-tour" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="welcome-tour-header">
          <div className="welcome-tour-brand"><i aria-hidden="true"><span /><span /><span /></i><strong>{copy.product}</strong></div>
          <button ref={closeButtonRef} type="button" className="welcome-tour-skip" onClick={onDismiss} aria-label={copy.close}>{copy.skip}<span aria-hidden="true">×</span></button>
        </header>

        <div className="welcome-tour-body" key={step.id}>
          <div className="welcome-tour-copy">
            <p className="welcome-tour-eyebrow">{step.eyebrow[locale]}</p>
            <h2 id={titleId}>{step.title[locale]}</h2>
            <p className="welcome-tour-description">{step.description[locale]}</p>
            <div className="welcome-tour-hint"><span aria-hidden="true">◎</span>{step.hint[locale]}</div>
          </div>

          <figure className="welcome-tour-media">
            <div className="welcome-tour-media-bar"><span><i /> LIVE PRODUCT DEMO</span><em>{String(stepIndex + 1).padStart(2, "0")} / {String(welcomeTourSteps.length).padStart(2, "0")}</em></div>
            <picture style={{ backgroundImage: `url("${assetUrl(step.poster)}")` }}>
              <source media="(prefers-reduced-motion: reduce)" srcSet={assetUrl(step.poster)} />
              <img src={assetUrl(step.gif)} alt={`${copy.media}：${step.title[locale]}`} width="960" height="540" />
            </picture>
          </figure>
        </div>

        <footer className="welcome-tour-footer">
          <div className="welcome-tour-progress" role="group" aria-label={`${copy.step} ${stepIndex + 1} / ${welcomeTourSteps.length}`}>
            {welcomeTourSteps.map((candidate, index) => (
              <button
                type="button"
                key={candidate.id}
                className={index === stepIndex ? "active" : index < stepIndex ? "complete" : ""}
                onClick={() => setStepIndex(index)}
                aria-label={`${copy.step} ${index + 1}: ${candidate.title[locale]}`}
                aria-current={index === stepIndex ? "step" : undefined}
              ><span>{index + 1}</span></button>
            ))}
          </div>
          <div className="welcome-tour-actions">
            <button type="button" className="welcome-tour-previous" disabled={isFirst} onClick={() => setStepIndex((current) => current - 1)}>← {copy.previous}</button>
            <button type="button" className="welcome-tour-next" onClick={() => isLast ? onDismiss() : setStepIndex((current) => current + 1)}>
              {isLast ? copy.start : copy.next}<span aria-hidden="true">{isLast ? "✓" : "→"}</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
