import { useId } from "react";

// A question that keeps its answer folded away until you ask for it.
const Fold = ({ index, question, open, onToggle, children }) => {
  const id = useId();

  return (
    <article className={`fold ${open ? "is-open" : ""}`}>
      <h4>
        <button
          type="button"
          className="fold__head"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
        >
          <span className="fold__index">{index}</span>
          <span className="fold__q">{question}</span>
          <span className="fold__icon" aria-hidden="true" />
        </button>
      </h4>
      <div className="fold__body" id={id} inert={!open}>
        <div className="fold__inner">{children}</div>
      </div>
    </article>
  );
};

export default Fold;
