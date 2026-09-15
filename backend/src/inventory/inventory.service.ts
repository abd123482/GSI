import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { CreateInventoryDTO } from "./dto/createInventory.dto.js";

@Injectable()
export class InventoryService {

    constructor(
        private readonly prisma: PrismaService
    ) { }

    async createEnventory(data: CreateInventoryDTO) {

        return await this.prisma.$transaction(async (tx) => {

            if (data.typeInventory === "ByEquipment") {

                const equipments = tx.equipment.findMany({
                    where: {
                        equipmentName: {
                            in: data.equipments
                        }
                    },
                    select: {
                        equipmentId: true,
                        hasSerialNumber: true
                    }
                }
                );

                const shelf = tx.shelf.findMany({
                    where: {
                        shelfName: {
                            in: data.shelfs
                        }
                    },
                    select: {
                        shelfId: true
                    }
                });

                const equipmentShelfs = tx.equipmentShelfs.findMany({
                    where: {
                        equipmentId: {
                            in: {
                                equipments.equipmentId
                            }
                        },
                        shelfId: {
                            in: {
                                shelf.shelfId
                            }
                        }
                    },
                    select: {
                        equipmentQuantity: true
                    }
                })

                const lastEquipmentQuantity = tx.inventory_Equipment.findMany({
                    where: {
                        equipmentId: {
                            in: {
                                equipments.equipmentId
                            }
                        }
                    }
                })

                for (let index = 0; index < (await equipments).length; index++) {

                    if ((await equipments)[index].hasSerialNumber) {

                        const serialNumbers = await tx.serialNumber.findMany({

                            where: {
                                equipmentId: (await equipments)[index].equipmentId
                            },

                            select: {
                                serialNumberCode: true
                            }
                        })
                    }


                }


            }

            if (data.typeInventory === "ByShelf") {

                const shelfs = tx.shelf.findMany({
                    where: {
                        shelfName: {
                            in: {
                                data.shelfs
                            }
                        }
                    },
                    select: {
                        shelfId: true
                    }

                });

                const equipmentShelfs = tx.equipmentShelfs.findMany({
                    where: {
                        shelfId: {
                            in: {
                                shelfs.shelfId
                            }
                        }
                    },
                    select: {
                        equipmentId: true,
                        equipmentQuantity: true

                    }
                })

                const equipments = tx.equipment.findMany({

                    where: {
                        equipmentId: {
                            in: {
                                equipmentShelfs.equipmentId
                            }
                        }
                    },

                    select: {
                        hasSerialNumber: true
                    }

                })

                for (let index = 0; index < (await equipments).length; index++) {

                    if ((await equipments)[index].hasSerialNumber) {

                        const serialNumbers = await tx.serialNumber.findMany({

                            where: {
                                equipmentId: (await equipments)[index].equipmentId
                            },

                            select: {
                                serialNumberCode: true
                            }
                        })
                    }


                }
            }
        }
        )
    }



}
