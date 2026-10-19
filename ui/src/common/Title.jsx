import React from 'react'
import { useMediaQuery } from '@material-ui/core'
import { useTranslate } from 'react-admin'

// The name shown in the header
export const APP_NAME = 'iPod Repair NYC'

export const Title = ({ subTitle, args }) => {
  const translate = useTranslate()
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('md'))
  const text = translate(subTitle, { ...args, _: subTitle })

  if (isDesktop) {
    return (
      <span>
        {APP_NAME}
        {text ? ` - ${text}` : ''}
      </span>
    )
  }
  return <span>{text ? text : APP_NAME}</span>
}
