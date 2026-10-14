import { useEffect, useRef } from "react";

/**
 * "Download PDF": opens the browser's print dialog, where "Save as PDF" is
 * one of the destinations. The print stylesheet (src/print.scss) turns the
 * page into a prep sheet; the document title becomes the suggested file name.
 */
const PrintButton = ({ title, className = "button secondary-button" }) => {
  const restore = useRef(null);

  useEffect(() => {
    const afterPrint = () => {
      if (restore.current !== null) document.title = restore.current;
      restore.current = null;
    };
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("afterprint", afterPrint);
      afterPrint();
    };
  }, []);

  const print = () => {
    restore.current = document.title;
    document.title = `Interview prep - ${title}`.replace(/[\\/:*?"<>|]+/g, " ").slice(0, 120);
    window.print();
  };

  return (
    <button
      type="button"
      className={`${className} print-button`}
      onClick={print}
      title="Opens the print dialog: choose “Save as PDF” as the destination"
    >
      Download PDF
    </button>
  );
};

export default PrintButton;
