import {
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  InboxOutlined,
  PlusSquareOutlined,
  PrinterOutlined,
  ToolOutlined,
  ToTopOutlined,
} from "@ant-design/icons";
import { List, useTable } from "@refinedev/antd";
import { IResourceComponentsProps, useInvalidate, useNavigation, useTranslate } from "@refinedev/core";
import { Button, Dropdown, Modal, Table } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Action,
  ActionsColumn,
  CustomFieldColumn,
  DateColumn,
  FilteredQueryColumn,
  NumberColumn,
  RichColumn,
  SortedColumn,
  SpoolIconColumn,
} from "../../components/column";
import { useLiveify } from "../../components/liveify";
import {
  useSpoolmanFilamentFilter,
  useSpoolmanLocations,
  useSpoolmanLotNumbers,
  useSpoolmanMaterials,
} from "../../components/otherModels";
import { removeUndefined } from "../../utils/filtering";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { TableState, useInitialTableState, useSavedState, useStoreInitialState } from "../../utils/saveload";
import { useCurrencyFormatter } from "../../utils/settings";
import { setSpoolArchived, useSpoolAdjustModal } from "./functions";
import { ISpool } from "./model";

dayjs.extend(utc);

const { confirm } = Modal;

interface ISpoolCollapsed extends ISpool {
  "filament.combined_name": string; // Eg. "Prusa - PLA Red"
  "filament.id": number;
  "filament.material"?: string;
}

function collapseSpool(element: ISpool): ISpoolCollapsed {
  let filament_name: string;
  if (element.filament.vendor && "name" in element.filament.vendor) {
    filament_name = `${element.filament.vendor.name} - ${element.filament.name}`;
  } else {
    filament_name = element.filament.name ?? element.filament.id.toString();
  }
  if (element.price === undefined) {
    element.price = element.filament.price;
  }
  return {
    ...element,
    "filament.combined_name": filament_name,
    "filament.id": element.filament.id,
    "filament.material": element.filament.material,
  };
}

function translateColumnI18nKey(columnName: string): string {
  columnName = columnName.replace(".", "_");
  if (columnName === "filament_combined_name") columnName = "filament_name";
  else if (columnName === "filament_material") columnName = "material";
  return `spool.fields.${columnName}`;
}

const namespace = "spoolList-v2";

const allColumns: (keyof ISpoolCollapsed & string)[] = [
  "id",
  "filament.combined_name",
  "filament.material",
  "price",
  "used_weight",
  "remaining_weight",
  "used_length",
  "remaining_length",
  "location",
  "lot_nr",
  "first_used",
  "last_used",
  "registered",
  "comment",
];
const defaultColumns = allColumns.filter(
  (column_id) => ["registered", "used_length", "remaining_length", "lot_nr"].indexOf(column_id) === -1
);

export const SpoolList: React.FC<IResourceComponentsProps> = () => {
  const t = useTranslate();
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const extraFields = useGetFields(EntityType.spool);
  const currencyFormatter = useCurrencyFormatter();
  const { openSpoolAdjustModal, spoolAdjustModal } = useSpoolAdjustModal();

  const allColumnsWithExtraFields = [...allColumns, ...(extraFields.data?.map((field) => "extra." + field.key) ?? [])];

  // Load initial state
  const initialState = useInitialTableState(namespace);

  // State for the switch to show archived spools
  const [showArchived, setShowArchived] = useSavedState("spoolList-showArchived", false);

  // Fetch data from the API
  // To provide the live updates, we use a custom solution (useLiveify) instead of the built-in refine "liveMode" feature.
  // This is because the built-in feature does not call the liveProvider subscriber with a list of IDs, but instead
  // calls it with a list of filters, sorters, etc. This means the server-side has to support this, which is quite hard.
  const { tableProps, sorters, setSorters, filters, setFilters, current, pageSize, setCurrent } =
    useTable<ISpoolCollapsed>({
      meta: {
        queryParams: {
          ["allow_archived"]: showArchived,
        },
      },
      syncWithLocation: false,
      pagination: {
        mode: "server",
        current: initialState.pagination.current,
        pageSize: initialState.pagination.pageSize,
      },
      sorters: {
        mode: "server",
        initial: initialState.sorters,
      },
      filters: {
        mode: "server",
        initial: initialState.filters,
      },
      liveMode: "manual",
      onLiveEvent(event) {
        if (event.type === "created" || event.type === "deleted") {
          // updated is handled by the liveify
          invalidate({
            resource: "spool",
            invalidates: ["list"],
          });
        }
      },
      queryOptions: {
        select(data) {
          return {
            total: data.total,
            data: data.data.map(collapseSpool),
          };
        },
      },
    });

  // Create state for the columns to show
  const [showColumns, setShowColumns] = useState<string[]>(initialState.showColumns ?? defaultColumns);

  // Store state in local storage
  const tableState: TableState = {
    sorters,
    filters,
    pagination: { current, pageSize },
    showColumns,
  };
  useStoreInitialState(namespace, tableState);

  // Collapse the dataSource to a mutable list
  const queryDataSource: ISpoolCollapsed[] = useMemo(
    () => (tableProps.dataSource || []).map((record) => ({ ...record })),
    [tableProps.dataSource]
  );
  const dataSource = useLiveify("spool", queryDataSource, collapseSpool);

  // Function for opening an ant design modal that asks for confirmation for archiving a spool
  const archiveSpool = async (spool: ISpoolCollapsed, archive: boolean) => {
    await setSpoolArchived(spool, archive);
    invalidate({
      resource: "spool",
      id: spool.id,
      invalidates: ["list", "detail"],
    });
  };

  const archiveSpoolPopup = async (spool: ISpoolCollapsed) => {
    // If the spool has no remaining weight, archive it immediately since it's likely not a mistake
    if (spool.remaining_weight != undefined && spool.remaining_weight <= 0) {
      await archiveSpool(spool, true);
    } else {
      confirm({
        title: t("spool.titles.archive"),
        content: t("spool.messages.archive"),
        okText: t("buttons.archive"),
        okType: "primary",
        cancelText: t("buttons.cancel"),
        onOk() {
          return archiveSpool(spool, true);
        },
      });
    }
  };

  if (tableProps.pagination) {
    tableProps.pagination.showSizeChanger = true;
  }

  const { editUrl, showUrl, cloneUrl } = useNavigation();
  const actions = useCallback(
    (record: ISpoolCollapsed) => {
      const actions: Action[] = [
        { name: t("buttons.show"), icon: <EyeOutlined />, link: showUrl("spool", record.id) },
        { name: t("buttons.edit"), icon: <EditOutlined />, link: editUrl("spool", record.id) },
        { name: t("buttons.clone"), icon: <PlusSquareOutlined />, link: cloneUrl("spool", record.id) },
        { name: t("spool.titles.adjust"), icon: <ToolOutlined />, onClick: () => openSpoolAdjustModal(record) },
      ];
      if (record.archived) {
        actions.push({
          name: t("buttons.unArchive"),
          icon: <ToTopOutlined />,
          onClick: () => archiveSpool(record, false),
        });
      } else {
        actions.push({ name: t("buttons.archive"), icon: <InboxOutlined />, onClick: () => archiveSpoolPopup(record) });
      }
      return actions;
    },
    [t, editUrl, showUrl, cloneUrl, openSpoolAdjustModal, archiveSpool, archiveSpoolPopup]
  );

  const originalOnChange = tableProps.onChange;
  tableProps.onChange = (pagination, filters, sorter, extra) => {
    // Rename any key called "filament.combined_name" in filters to "filament.id"
    // This is because we want to use combined_name for sorting, but id for filtering,
    // and Ant Design and Refine only supports specifying a single field for both.
    Object.keys(filters).forEach((key) => {
      if (key === "filament.combined_name") {
        filters["filament.id"] = filters[key];
        delete filters[key];
      }
    });

    originalOnChange?.(pagination, filters, sorter, extra);
  };

  const commonProps = {
    t,
    navigate,
    actions,
    dataSource,
    tableState,
    sorter: true,
  };

  return (
    <List
      headerButtons={({ defaultButtons }) => (
        <>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => {
              navigate("print");
            }}
          >
            {t("printing.qrcode.button")}
          </Button>
          <Button
            type="primary"
            icon={<InboxOutlined />}
            onClick={() => {
              setShowArchived(!showArchived);
            }}
          >
            {showArchived ? t("buttons.hideArchived") : t("buttons.showArchived")}
          </Button>
          <Button
            type="primary"
            icon={<FilterOutlined />}
            onClick={() => {
              setFilters([], "replace");
              setSorters([{ field: "id", order: "asc" }]);
              setCurrent(1);
            }}
          >
            {t("buttons.clearFilters")}
          </Button>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: allColumnsWithExtraFields.map((column_id) => {
                if (column_id.indexOf("extra.") === 0) {
                  const extraField = extraFields.data?.find((field) => "extra." + field.key === column_id);
                  return {
                    key: column_id,
                    label: extraField?.name ?? column_id,
                  };
                }

                return {
                  key: column_id,
                  label: t(translateColumnI18nKey(column_id)),
                };
              }),
              selectedKeys: showColumns,
              selectable: true,
              multiple: true,
              onDeselect: (keys) => {
                setShowColumns(keys.selectedKeys);
              },
              onSelect: (keys) => {
                setShowColumns(keys.selectedKeys);
              },
            }}
          >
            <Button type="primary" icon={<EditOutlined />}>
              {t("buttons.hideColumns")}
            </Button>
          </Dropdown>
          {defaultButtons}
        </>
      )}
    >
      {spoolAdjustModal}
      <Table
        {...tableProps}
        sticky
        tableLayout="auto"
        scroll={{ x: "max-content" }}
        dataSource={dataSource}
        rowKey="id"
        // Make archived rows greyed out
        onRow={(record) => {
          if (record.archived) {
            return {
              style: {
                fontStyle: "italic",
                color: "#999",
              },
            };
          } else {
            return {};
          }
        }}
        columns={removeUndefined([
          SortedColumn({
            ...commonProps,
            id: "id",
            i18ncat: "spool",
            width: 70,
          }),
          SpoolIconColumn({
            ...commonProps,
            id: "filament.combined_name",
            i18nkey: "spool.fields.filament_name",
            color: (record: ISpoolCollapsed) =>
              record.filament.multi_color_hexes
                ? {
                    colors: record.filament.multi_color_hexes.split(","),
                    vertical: record.filament.multi_color_direction === "longitudinal",
                  }
                : record.filament.color_hex,
            dataId: "filament.combined_name",
            filterValueQuery: useSpoolmanFilamentFilter(),
          }),
          FilteredQueryColumn({
            ...commonProps,
            id: "filament.material",
            i18nkey: "spool.fields.material",
            filterValueQuery: useSpoolmanMaterials(),
            width: 120,
          }),
          SortedColumn({
            ...commonProps,
            id: "price",
            i18ncat: "spool",
            align: "right",
            width: 80,
            render: (_, obj: ISpoolCollapsed) => {
              if (obj.price === undefined) {
                return "";
              }
              return currencyFormatter.format(obj.price);
            },
          }),
          NumberColumn({
            ...commonProps,
            id: "used_weight",
            i18ncat: "spool",
            align: "right",
            unit: "g",
            maxDecimals: 0,
            width: 110,
          }),
          NumberColumn({
            ...commonProps,
            id: "remaining_weight",
            i18ncat: "spool",
            unit: "g",
            maxDecimals: 0,
            defaultText: t("unknown"),
            width: 110,
          }),
          NumberColumn({
            ...commonProps,
            id: "used_length",
            i18ncat: "spool",
            unit: "mm",
            maxDecimals: 0,
            width: 120,
          }),
          NumberColumn({
            ...commonProps,
            id: "remaining_length",
            i18ncat: "spool",
            unit: "mm",
            maxDecimals: 0,
            defaultText: t("unknown"),
            width: 120,
          }),
          FilteredQueryColumn({
            ...commonProps,
            id: "location",
            i18ncat: "spool",
            filterValueQuery: useSpoolmanLocations(),
            width: 120,
          }),
          FilteredQueryColumn({
            ...commonProps,
            id: "lot_nr",
            i18ncat: "spool",
            filterValueQuery: useSpoolmanLotNumbers(),
            width: 120,
          }),
          DateColumn({
            ...commonProps,
            id: "first_used",
            i18ncat: "spool",
          }),
          DateColumn({
            ...commonProps,
            id: "last_used",
            i18ncat: "spool",
          }),
          DateColumn({
            ...commonProps,
            id: "registered",
            i18ncat: "spool",
          }),
          ...(extraFields.data?.map((field) => {
            return CustomFieldColumn({
              ...commonProps,
              field,
            });
          }) ?? []),
          RichColumn({
            ...commonProps,
            id: "comment",
            i18ncat: "spool",
            width: 150,
          }),
          ActionsColumn(t("table.actions"), actions),
        ])}
      />
    </List>
  );
};

export default SpoolList;
