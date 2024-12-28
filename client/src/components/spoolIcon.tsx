import "./spoolIcon.css";

interface Props {
  color: string | { colors: string[]; vertical: boolean };
  size?: "small" | "large";
  no_margin? : boolean
}

export default function SpoolIcon(props: Readonly<Props>) {
  let dirClass = "vertical";
  let cols = [];
  let size = props.size ? props.size : "small";
  let no_margin = props.no_margin ? "no-margin" : "";
  
  if (typeof props.color === "string") {
    cols = [props.color];
  } else {
    dirClass = props.color.vertical ? "vertical" : "horizontal";
    cols = props.color.colors;
  }

  return (
    <div className={"spool-icon " + dirClass + " " + size + " " + no_margin}>
      {cols.map((col) => (
        <div
          key={col}
          style={{
            backgroundColor: "#" + col.replace("#", ""),
          }}
        ></div>
      ))}
    </div>
  );
}
