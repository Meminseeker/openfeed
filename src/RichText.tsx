import React from "react";
import type { RichBlock, RichSpan } from "./types";

function Spans({ spans }: { spans: RichSpan[] }) {
  return (
    <>
      {spans.map((s, i) => {
        let node: React.ReactNode = s.text;
        if (s.underline) node = <u>{node}</u>;
        if (s.italic) node = <em>{node}</em>;
        if (s.bold) node = <strong>{node}</strong>;
        if (s.href)
          node = (
            <a href={s.href} target="_blank" rel="noreferrer">
              {node}
            </a>
          );
        return <React.Fragment key={i}>{node}</React.Fragment>;
      })}
    </>
  );
}

// Renders sanitized blocks as React elements; consecutive items form one list.
export function RichText({ blocks }: { blocks: RichBlock[] }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "item") {
      const items = [];
      while (
        i < blocks.length &&
        blocks[i].type === "item" &&
        (blocks[i] as typeof b).ordered === b.ordered
      ) {
        const item = blocks[i] as typeof b;
        items.push(
          <li key={i}>
            <Spans spans={item.spans} />
          </li>,
        );
        i++;
      }
      i--;
      out.push(b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>);
    } else if (b.type === "heading")
      out.push(
        b.level <= 2 ? (
          <h3 key={i}>
            <Spans spans={b.spans} />
          </h3>
        ) : (
          <h4 key={i}>
            <Spans spans={b.spans} />
          </h4>
        ),
      );
    else if (b.type === "quote")
      out.push(
        <blockquote key={i}>
          <Spans spans={b.spans} />
        </blockquote>,
      );
    else if (b.type === "image")
      out.push(
        <img
          key={i}
          src={b.src}
          alt=""
          width={b.width}
          height={b.height}
          loading="lazy"
          referrerPolicy="no-referrer"
        />,
      );
    else if (b.type === "rule") out.push(<hr key={i} />);
    else
      out.push(
        <p key={i}>
          <Spans spans={b.spans} />
        </p>,
      );
  }
  return <div className="rich-text">{out}</div>;
}
