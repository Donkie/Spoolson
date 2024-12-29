"""SQLAlchemy data models."""

from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(AsyncAttrs, DeclarativeBase):
    pass


class Vendor(Base):
    __tablename__ = "vendor"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    registered: Mapped[datetime] = mapped_column()
    name: Mapped[str] = mapped_column(String(64))
    empty_spool_weight: Mapped[Optional[float]] = mapped_column(comment="The weight of an empty spool.")
    comment: Mapped[Optional[str]] = mapped_column(String(1024))
    filaments: Mapped[list["Filament"]] = relationship(back_populates="vendor")
    external_id: Mapped[Optional[str]] = mapped_column(String(256))
    extra: Mapped[list["VendorField"]] = relationship(
        back_populates="vendor",
        cascade="save-update, merge, delete, delete-orphan",
        lazy="joined",
    )


class Filament(Base):
    __tablename__ = "filament"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registered: Mapped[datetime] = mapped_column()
    name: Mapped[Optional[str]] = mapped_column(String(64))
    vendor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vendor.id"))
    vendor: Mapped[Optional["Vendor"]] = relationship(back_populates="filaments")
    spools: Mapped[list["Spool"]] = relationship(back_populates="filament")
    material: Mapped[Optional[str]] = mapped_column(String(64))
    price: Mapped[Optional[float]] = mapped_column()
    density: Mapped[float] = mapped_column()
    diameter: Mapped[float] = mapped_column()
    weight: Mapped[Optional[float]] = mapped_column(comment="The filament weight of a full spool (net weight).")
    spool_weight: Mapped[Optional[float]] = mapped_column(comment="The weight of an empty spool.")
    article_number: Mapped[Optional[str]] = mapped_column(String(64))
    comment: Mapped[Optional[str]] = mapped_column(String(1024))
    settings_extruder_temp: Mapped[Optional[int]] = mapped_column(comment="Overridden extruder temperature.")
    settings_bed_temp: Mapped[Optional[int]] = mapped_column(comment="Overridden bed temperature.")
    color_hex: Mapped[Optional[str]] = mapped_column(String(8))
    multi_color_hexes: Mapped[Optional[str]] = mapped_column(String(128))
    multi_color_direction: Mapped[Optional[str]] = mapped_column(String(16))
    external_id: Mapped[Optional[str]] = mapped_column(String(256))
    extra: Mapped[list["FilamentField"]] = relationship(
        back_populates="filament",
        cascade="save-update, merge, delete, delete-orphan",
        lazy="joined",
    )


class Spool(Base):
    __tablename__ = "spool"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registered: Mapped[datetime] = mapped_column()
    first_used: Mapped[Optional[datetime]] = mapped_column()
    last_used: Mapped[Optional[datetime]] = mapped_column()
    price: Mapped[Optional[float]] = mapped_column()
    filament_id: Mapped[int] = mapped_column(ForeignKey("filament.id"))
    filament: Mapped["Filament"] = relationship(back_populates="spools")
    initial_weight: Mapped[Optional[float]] = mapped_column()
    spool_weight: Mapped[Optional[float]] = mapped_column()
    used_weight: Mapped[float] = mapped_column()
    location_id: Mapped[Optional[int]] = mapped_column(ForeignKey("location.id"))
    location: Mapped[Optional["Location"]] = relationship("Location", back_populates="spools")
    lot_nr: Mapped[Optional[str]] = mapped_column(String(64))
    comment: Mapped[Optional[str]] = mapped_column(String(1024))
    archived: Mapped[Optional[bool]] = mapped_column()
    extra: Mapped[list["SpoolField"]] = relationship(
        back_populates="spool",
        cascade="save-update, merge, delete, delete-orphan",
        lazy="joined",
    )


class Location(Base):
    __tablename__ = "location"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registered: Mapped[datetime] = mapped_column()
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    spools: Mapped[list["Spool"]] = relationship("Spool", back_populates="location")
    extra: Mapped[list["LocationField"]] = relationship(
        back_populates="location",
        cascade="save-update, merge, delete, delete-orphan",
        lazy="joined",
    )


class Setting(Base):
    __tablename__ = "setting"

    key: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    value: Mapped[str] = mapped_column(Text())
    last_updated: Mapped[datetime] = mapped_column()


class VendorField(Base):
    __tablename__ = "vendor_field"

    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendor.id"), primary_key=True, index=True)
    vendor: Mapped["Vendor"] = relationship(back_populates="extra")
    key: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    value: Mapped[str] = mapped_column(Text())


class FilamentField(Base):
    __tablename__ = "filament_field"

    filament_id: Mapped[int] = mapped_column(ForeignKey("filament.id"), primary_key=True, index=True)
    filament: Mapped["Filament"] = relationship(back_populates="extra")
    key: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    value: Mapped[str] = mapped_column(Text())


class SpoolField(Base):
    __tablename__ = "spool_field"

    spool_id: Mapped[int] = mapped_column(ForeignKey("spool.id"), primary_key=True, index=True)
    spool: Mapped["Spool"] = relationship(back_populates="extra")
    key: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    value: Mapped[str] = mapped_column(Text())


class LocationField(Base):
    __tablename__ = "location_field"

    location_id: Mapped[int] = mapped_column(ForeignKey("location.id"), primary_key=True, index=True)
    location: Mapped["Location"] = relationship(back_populates="extra")
    key: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    value: Mapped[str] = mapped_column(Text())
