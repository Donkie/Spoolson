import { useTranslate } from "@refinedev/core";
import { Form, Modal, Select } from "antd";
import { Trans } from "react-i18next";
import { formatFilamentLabel } from "../pages/spools/functions";
import { useCurrency } from "../utils/settings";
import { searchMatches } from "../utils/filtering";
import { ExternalFilament, useGetExternalDBFilaments } from "../utils/queryExternalDB";

export function FilamentImportModal(props: {
  isOpen: boolean;
  onImport: (filament: ExternalFilament) => void;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const t = useTranslate();

  const currency = useCurrency();
  
  const externalFilaments = useGetExternalDBFilaments(currency);
  const filamentOptions =
    externalFilaments.data?.map((item) => {
      return {
        label: formatFilamentLabel(
          item.name,
          item.diameter,
          item.manufacturer,
          item.material,
          item.weight,
          item.spool_type
        ),
        value: item.id,
        item: item,
      };
    }) ?? [];
  filamentOptions.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

  return (
    <Modal
      title={t("filament.form.import_external")}
      open={props.isOpen}
      onOk={() => form.submit()}
      onCancel={() => props.onClose()}
    >
      <Form
        layout="vertical"
        form={form}
        onFinish={(values) => {
          const filament = filamentOptions.find((item) => item.value === values.filament)?.item;
          if (!filament) {
            throw new Error("Filament not found");
          }
          props.onImport(filament);
          props.onClose();
          form.resetFields();
        }}
      >
        <p>
          <Trans
            i18nKey={"filament.form.import_external_description"}
            components={{
              br: <br />,
            }}
          />
        </p>
        <Form.Item name="filament" rules={[{ required: true }]}>
          <Select
            options={filamentOptions}
            showSearch
            filterOption={(input, option) => typeof option?.label === "string" && searchMatches(input, option?.label)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
