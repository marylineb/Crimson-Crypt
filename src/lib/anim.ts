import { gsap } from "gsap";

export function vampEnter(root: HTMLElement) {
  // Anim globale: card + éléments "data-anim"
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

  const card = root.querySelector("[data-card]") as HTMLElement | null;
  const items = root.querySelectorAll("[data-anim]");

  if (card) {
    gsap.set(card, { transformPerspective: 900 });
    tl.fromTo(card,
      { y: 18, opacity: 0, rotateX: 10, filter: "blur(6px)" },
      { y: 0, opacity: 1, rotateX: 0, filter: "blur(0px)", duration: 0.65 }
    );
  }

  if (items.length) {
    tl.fromTo(items,
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.06 },
      card ? "-=0.35" : 0
    );
  }

  // petit glow “vampire”
  if (card) {
    tl.fromTo(card,
      { boxShadow: "0 0 0 rgba(255,46,70,0)" },
      { boxShadow: "0 0 24px rgba(255,46,70,.22)", duration: 0.55 },
      "-=0.35"
    );
  }

  return tl;
}

export function vampButtonHover(el: HTMLElement) {
  // Hover magnétique + micro-tilt
  const enter = () => gsap.to(el, { scale: 1.03, duration: 0.18, ease: "power2.out" });
  const leave = () => gsap.to(el, { scale: 1, duration: 0.22, ease: "power2.out" });

  el.addEventListener("mouseenter", enter);
  el.addEventListener("mouseleave", leave);

  return () => {
    el.removeEventListener("mouseenter", enter);
    el.removeEventListener("mouseleave", leave);
  };
}

export function vampShake(el: HTMLElement) {
  return gsap.fromTo(el, { x: -4 }, { x: 4, duration: 0.06, yoyo: true, repeat: 6, ease: "power1.inOut" });
}